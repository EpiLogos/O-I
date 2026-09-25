// Two differently-keyed knowledge() calls (e.g. an explicit `fresh:true`
// read racing an ordinary one, or two independent callers reading the same
// owner resource) name the SAME kernel read ticket
// (`knowledge:pending:{project}:{request}` — `fresh` is not part of that
// key; kernel/src/knowledge_prepared.rs). The kernel's "latest wins" ticket
// law is deliberate for a genuinely newer read (proven by the native
// concurrency test in kernel/src/knowledge_prepared_tests.rs), but two of
// OUR OWN concurrent requests for the identical resource have no such
// intent — running them at once just supersedes one by accident of timing.
//
// This reproduced as a real regression: WikiConstructionPanel's post-save
// register refresh (KnowledgeSurface's generation bump) and construction.ts
// revalidatePassage's pre-apply `fresh:true` read both target the same
// source while a save is in flight; whichever started first had its kernel
// ticket superseded by the other, and even the client's single retry
// (client.ts) could itself be superseded by the still-running sibling.
// KnowledgeReadCoordinator now serialises same-resource entries so the
// kernel never sees two of our own concurrent requests for one resource.
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeReadCoordinator} from '../src/knowledge/requests.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
const settle = () => new Promise(resolve => setImmediate(resolve));

test('two differently-keyed reads of the same resource never run concurrently', async () => {
  const queue = new KnowledgeReadCoordinator(4);
  const started = [];
  const plain = deferred();
  const p1 = queue.read('plain', () => { started.push('plain'); return plain.promise; }, undefined, 'source:a');
  await settle();
  assert.deepEqual(started, ['plain'], 'the first same-resource entry starts immediately');
  const freshStarted = deferred();
  const fresh = deferred();
  const p2 = queue.read('fresh', () => { started.push('fresh'); freshStarted.resolve(); return fresh.promise; }, undefined, 'source:a');
  await settle();
  assert.deepEqual(started, ['plain'], 'a second entry for the SAME resource must not start while the first is in flight — starting it would race the same kernel read ticket');
  plain.resolve('plain-result');
  await settle();
  assert.deepEqual(started, ['plain', 'fresh'], 'the queued same-resource entry starts only once the first has settled — no ticket ever collides');
  fresh.resolve('fresh-result');
  assert.equal(await p1, 'plain-result');
  assert.equal(await p2, 'fresh-result');
});

test('a same-resource entry still starts after the first one FAILS, not only after success', async () => {
  const queue = new KnowledgeReadCoordinator(4);
  const started = [];
  const first = deferred();
  const p1 = queue.read('a', () => { started.push('a'); return first.promise; }, undefined, 'source:x');
  await settle();
  const second = deferred();
  const p2 = queue.read('b', () => { started.push('b'); return second.promise; }, undefined, 'source:x');
  await settle();
  assert.deepEqual(started, ['a']);
  first.reject(new Error('superseded'));
  await assert.rejects(p1, /superseded/);
  await settle();
  assert.deepEqual(started, ['a', 'b'], 'the second entry proceeds once the first settles, whether it succeeded or failed');
  second.resolve('ok');
  assert.equal(await p2, 'ok');
});

test('entries for DIFFERENT resources still run concurrently — serialisation is per resource, not global', async () => {
  const queue = new KnowledgeReadCoordinator(4);
  const started = [];
  const a = deferred(), b = deferred();
  const p1 = queue.read('key-a', () => { started.push('a'); return a.promise; }, undefined, 'source:a');
  const p2 = queue.read('key-b', () => { started.push('b'); return b.promise; }, undefined, 'source:b');
  await settle();
  assert.deepEqual(started.sort(), ['a', 'b'], 'unrelated resources are not serialised against each other');
  a.resolve(1); b.resolve(2);
  assert.deepEqual(await Promise.all([p1, p2]), [1, 2]);
});

test('omitting `resource` keeps exact prior behaviour — no cross-key serialisation', async () => {
  const queue = new KnowledgeReadCoordinator(4);
  const started = [];
  const a = deferred(), b = deferred();
  const p1 = queue.read('key-a', () => { started.push('a'); return a.promise; });
  const p2 = queue.read('key-b', () => { started.push('b'); return b.promise; });
  await settle();
  assert.deepEqual(started.sort(), ['a', 'b'], 'distinct keys without an explicit resource never serialise against each other');
  a.resolve(1); b.resolve(2);
  assert.deepEqual(await Promise.all([p1, p2]), [1, 2]);
});

test('the identical key still coalesces into one run, as before (resource serialisation is additive)', async () => {
  const queue = new KnowledgeReadCoordinator(4);
  let runs = 0;
  const native = deferred();
  const p1 = queue.read('same', () => { runs++; return native.promise; }, undefined, 'source:a');
  const p2 = queue.read('same', () => { runs++; return native.promise; }, undefined, 'source:a');
  await settle();
  assert.equal(runs, 1, 'the exact same key is one owner read, not two');
  native.resolve('shared');
  assert.deepEqual(await Promise.all([p1, p2]), ['shared', 'shared']);
});
