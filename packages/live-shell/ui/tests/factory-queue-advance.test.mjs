// T-FACTORY-2: the Factory receiving/advancement join, as a pure model.
// receiveReturn is the conformance model of the owner's advancement: exactly
// one advance per Return, duplicate Returns are idempotent, stale or foreign
// Returns are refused with an owner-named reason. It holds no view, so the
// "advance with the view closed" check is scripted here by re-reading the
// queue from a serialised copy with no view in scope. The native owner
// operation is NOT built; that leg stays UNVERIFIED native.
//
// Run: node --test tests/factory-queue-advance.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

const root = new URL('../../../../', import.meta.url)
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
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

const {receiveReturn, startQueue} = await import(new URL('packages/live-shell/ui/src/agent/factoryQueueAdvance.ts', root).href)

const QUEUE = 'queue:factory-work-1'
const ret = (returnRef, runRef, expectedRevision, queueRef = QUEUE) => ({queueRef, returnRef, runRef, expectedRevision})
const runningOf = snapshot => snapshot.items.filter(item => item.state === 'running').map(item => item.runRef)

test('a Return advances the queue exactly once to the next queued Run', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B', 'run:C'])
  const out = receiveReturn(start, ret('return:A1', 'run:A', 0))
  assert.equal(out.outcome, 'applied')
  assert.deepEqual(runningOf(out.snapshot), ['run:B'])
  assert.deepEqual(out.snapshot.items.map(item => item.state), ['done', 'running', 'queued'])
  assert.equal(out.snapshot.revision, 1)
  assert.deepEqual(out.receipt, {queueRef: QUEUE, returnRef: 'return:A1', runRef: 'run:A', revisionBefore: 0, revisionAfter: 1, advancedTo: 'run:B'})
})

test('a duplicate Return is idempotent: no second advance, the prior receipt is returned', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B', 'run:C'])
  const first = receiveReturn(start, ret('return:A1', 'run:A', 0))
  const again = receiveReturn(first.snapshot, ret('return:A1', 'run:A', 0))
  assert.equal(again.outcome, 'already-applied')
  assert.deepEqual(again.receipt, first.receipt)
  assert.deepEqual(again.snapshot, first.snapshot)
  assert.deepEqual(runningOf(again.snapshot), ['run:B'], 'C must not be skipped to')
  assert.equal(again.snapshot.revision, 1)
})

test('a Return replayed against the original snapshot yields the same outcome each time', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B'])
  const one = receiveReturn(start, ret('return:A1', 'run:A', 0))
  const two = receiveReturn(start, ret('return:A1', 'run:A', 0))
  assert.deepEqual(one, two)
})

test('a stale Return (read at an old revision) is refused by the owner, nothing advances', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B', 'run:C'])
  const advanced = receiveReturn(start, ret('return:A1', 'run:A', 0)).snapshot
  // run:B is now running at revision 1; a Return for B that was read at 0 is stale.
  const stale = receiveReturn(advanced, ret('return:B1', 'run:B', 0))
  assert.equal(stale.outcome, 'refused')
  assert.equal(stale.reason, 'stale')
  assert.equal(stale.ownerRef, QUEUE)
  assert.deepEqual(stale.snapshot, advanced)
})

test('a foreign-queue Return is refused and names the owning queue', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B'])
  const foreign = receiveReturn(start, ret('return:X', 'run:A', 0, 'queue:someone-else'))
  assert.equal(foreign.outcome, 'refused')
  assert.equal(foreign.reason, 'foreign-queue')
  assert.equal(foreign.ownerRef, QUEUE)
  assert.deepEqual(foreign.snapshot, start)
})

test('a Return for a Run not in the queue is refused as unknown', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B'])
  const unknown = receiveReturn(start, ret('return:Z', 'run:Z', 0))
  assert.equal(unknown.outcome, 'refused')
  assert.equal(unknown.reason, 'unknown-run')
  assert.deepEqual(unknown.snapshot, start)
})

test('a Return for a queued (not running) Run cannot advance the queue', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B'])
  const early = receiveReturn(start, ret('return:B0', 'run:B', 0))
  assert.equal(early.outcome, 'refused')
  assert.equal(early.reason, 'not-running')
  assert.deepEqual(runningOf(early.snapshot), ['run:A'])
})

test('one return ref cannot be replayed for a different Run', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B'])
  const first = receiveReturn(start, ret('return:A1', 'run:A', 0))
  const clash = receiveReturn(first.snapshot, ret('return:A1', 'run:B', 1))
  assert.equal(clash.outcome, 'refused')
  assert.equal(clash.reason, 'conflicting-replay')
  assert.deepEqual(clash.snapshot, first.snapshot)
})

test('the last Return drains the queue (advancedTo null), and its replay stays idempotent', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B'])
  const a = receiveReturn(start, ret('return:A1', 'run:A', 0))
  const b = receiveReturn(a.snapshot, ret('return:B1', 'run:B', 1))
  assert.equal(b.outcome, 'applied')
  assert.equal(b.receipt.advancedTo, null)
  assert.deepEqual(runningOf(b.snapshot), [])
  assert.deepEqual(b.snapshot.items.map(item => item.state), ['done', 'done'])
  const replay = receiveReturn(b.snapshot, ret('return:B1', 'run:B', 1))
  assert.equal(replay.outcome, 'already-applied')
  assert.deepEqual(replay.snapshot, b.snapshot)
})

test('each applied advance moves the revision by exactly one across a full walk', () => {
  let snapshot = startQueue(QUEUE, ['run:A', 'run:B', 'run:C'])
  const revisions = [snapshot.revision]
  for (const [index, run] of ['run:A', 'run:B', 'run:C'].entries()) {
    const out = receiveReturn(snapshot, ret(`return:${index}`, run, snapshot.revision))
    assert.equal(out.outcome, 'applied')
    snapshot = out.snapshot
    revisions.push(snapshot.revision)
  }
  assert.deepEqual(revisions, [0, 1, 2, 3])
  assert.equal(Object.keys(snapshot.receipts).length, 3)
})

test('the input snapshot is never mutated', () => {
  const start = startQueue(QUEUE, ['run:A', 'run:B'])
  const before = JSON.stringify(start)
  receiveReturn(start, ret('return:A1', 'run:A', 0))
  receiveReturn(start, ret('return:A1', 'run:A', 0))
  receiveReturn(start, ret('return:Z', 'run:Z', 0))
  assert.equal(JSON.stringify(start), before)
})

test('advance with the view closed (scripted): a serialised re-read gives the same advance', () => {
  // No view, no React, no closure over a presentation: the queue is read back
  // from its serialised form, as a later owner read would supply it.
  const start = startQueue(QUEUE, ['run:A', 'run:B', 'run:C'])
  const beforeClose = receiveReturn(start, ret('return:A1', 'run:A', 0))
  const reread = JSON.parse(JSON.stringify(beforeClose.snapshot))
  const afterClose = receiveReturn(reread, ret('return:B1', 'run:B', 1))
  assert.equal(afterClose.outcome, 'applied')
  assert.deepEqual(runningOf(afterClose.snapshot), ['run:C'])
  assert.equal(afterClose.snapshot.revision, 2)
})

test('startQueue refuses an empty or duplicated queue', () => {
  assert.throws(() => startQueue(QUEUE, []), /no Runs/)
  assert.throws(() => startQueue(QUEUE, ['run:A', 'run:A']), /more than once/)
})
