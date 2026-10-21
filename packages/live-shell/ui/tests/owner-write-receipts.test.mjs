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

const {receiptMovesTemporal, receiptMovesDay, receiptMovesAgency, createReceiptCursor, OWNER_WRITE_RECEIPTS} = await import('../src/owners/notices.ts')
const {createTemporalPoll} = await import('../src/timeline/temporalPoll.ts')
const {createOwnerReadings} = await import('../src/owners/ownerReading.ts')
const {createDayReceiptObserver, dayStandingKey} = await import('../src/owners/day.ts')

const nowChanged = JSON.parse(await readFile(new URL('./fixtures/kernel-receipts/now-changed.json', import.meta.url), 'utf8'))
const receipt = (seq, event, extra = {}) => ({seq, schema: 'oi.kernel-event/v1', version: 1, event, ...extra})
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setImmediate(resolve)) }

test('the kernel\'s owner-write receipts move the temporal field; the Day moves only on its own; none moves agency', () => {
  assert.equal(nowChanged.event, 'now_changed')
  assert.deepEqual([...OWNER_WRITE_RECEIPTS].sort(), ['day_changed', 'factory_run_changed', 'now_changed', 'owner_changed', 'receiving_changed'])
  for (const event of OWNER_WRITE_RECEIPTS) {
    assert.equal(receiptMovesTemporal(receipt(1, event, {owner: 'central', action: 'a', ref: 'r'})), true, event)
    assert.equal(receiptMovesAgency(receipt(1, event)), false, `${event} says nothing about sessions`)
  }
  assert.equal(receiptMovesTemporal(nowChanged), true)
  assert.equal(receiptMovesDay(receipt(1, 'day_changed', {owner: 'central', action: 'central.day.ensure', ref: 'central:day:2026-10-16'})), true)
  assert.equal(receiptMovesDay(nowChanged), false)
  assert.equal(receiptMovesTemporal(receipt(1, 'presentation_changed')), false, 'a receipt about nothing the field reads')
})

test('a NOW write\'s receipt makes the temporal read read again within 1 s, with no floor involved', async (t) => {
  const transport = {kind: 'bridge', url: 'http://bridge.test/owner-write-receipts'}
  const asked = []
  const poll = createTemporalPoll(transport, {
    kernelOp: async (_transport, op) => {
      asked.push({op: op.op, at: Date.now()})
      return {outcome: {result: 'temporal_events_reading', document: {events: [], absences: []}}}
    },
    // No floor: the only reads are the first reader's and the ones a notice asks for.
    floorMs: Number.POSITIVE_INFINITY,
    visible: () => true,
    onAttention: () => () => {},
    onTold: () => () => {},
  })
  const release = poll.subscribe(() => {})
  try {
    await settle()
    assert.equal(asked.length, 1, 'the first reader reads once')
    const epoch = '1|central'
    // The spine's receipts as they stood: taken as already read.
    poll.observe([receipt(41, 'surface_changed')], epoch)
    await settle()
    assert.equal(asked.length, 1)
    const told = Date.now()
    poll.observe([receipt(41, 'surface_changed'), {...nowChanged, seq: 42}], epoch)
    await settle()
    assert.equal(asked.length, 2, 'the receipt asked for one read')
    assert.ok(asked[1].at - told <= 1000, `read again ${asked[1].at - told} ms after the receipt`)
    t.diagnostic(`read again ${asked[1].at - told} ms after the now_changed receipt`)
    assert.equal(poll.snapshot().cause, 'kernel receipt now_changed')
    // The same receipts passed again (another reader) ask nothing more.
    poll.observe([receipt(41, 'surface_changed'), {...nowChanged, seq: 42}], epoch)
    await settle()
    assert.equal(asked.length, 2)
  } finally {
    release()
    await settle()
  }
})

test('a Day write\'s receipt reads every held Day again, its remembered refusal too', async () => {
  const registry = createOwnerReadings(() => 1_000)
  const transport = {kind: 'bridge', url: 'http://bridge.test/day'}
  let asks = 0
  let stale = true
  const entry = registry.entry(dayStandingKey(transport, null), async () => {
    asks++
    return stale ? {error: 'The native today pointer is stale; explicitly ensure the current Day under the native time policy'}
      : {value: {state: 'ready'}}
  })
  const off = entry.subscribe(() => {})
  try {
    const epoch = '1|central'
    await entry.ensure(epoch)
    assert.equal(entry.snapshot().status, 'refused')
    await entry.refresh(epoch)
    assert.equal(asks, 1, 'a remembered refusal is not asked again by a notice')
    const observe = createDayReceiptObserver(registry)
    assert.equal(observe([receipt(7, 'surface_changed')], epoch), 0, 'the first observation takes what stands')
    assert.equal(observe([receipt(7, 'surface_changed'), receipt(8, 'now_changed', {owner: 'central', action: 'a', ref: 'r'})], epoch), 0,
      'a NOW receipt does not move the Day')
    stale = false
    assert.equal(observe([receipt(9, 'day_changed', {owner: 'central', action: 'central.day.ensure', ref: 'central:day:2026-10-16'})], epoch), 1)
    await settle()
    assert.equal(asks, 2, 'the Day the kernel says moved is read again')
    assert.equal(entry.snapshot().status, 'answered')
  } finally {
    off()
  }
})

test('a receipt cursor takes each receipt once and starts again after a kernel restart', () => {
  const fresh = createReceiptCursor()
  assert.deepEqual(fresh([receipt(3, 'a'), receipt(4, 'b')]), [])
  assert.deepEqual(fresh([receipt(3, 'a'), receipt(4, 'b'), receipt(5, 'c')]).map(r => r.seq), [5])
  assert.deepEqual(fresh([receipt(3, 'a'), receipt(4, 'b'), receipt(5, 'c')]), [])
  assert.deepEqual(fresh([receipt(1, 'restarted')]).map(r => r.seq), [1])
})
