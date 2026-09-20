import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeReadCoordinator} from '../src/knowledge/requests.ts';
import {progressiveSearch, searchKeys, preserveSearchSelection} from '../src/knowledge/searchProgress.ts';
import {knowledge} from '../src/knowledge/client.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const hit = (ref, label = ref) => ({resource: ref, label, kind: 'knowledge-source', provider: 'native', authority: 'authored', snippet: '', address: {kind: 'source', value: ref}});

test('the fast provider is actionable while the other is still pending', async () => {
  const first = deferred(), second = deferred(), snapshots = [];
  progressiveSearch(() => first.promise, () => second.promise, value => snapshots.push(value));
  first.resolve({hits: [hit('source:a')], absences: []});
  await settle();
  assert.deepEqual(snapshots.at(-1).hits.map(row => row.resource), ['source:a']);
  assert.deepEqual(snapshots.at(-1).pending, ['resolve']);
  second.resolve({hits: [hit('source:a'), hit('source:b')], rows: [], absences: []});
  await settle();
  assert.deepEqual(snapshots.at(-1).hits.map(row => row.resource), ['source:a', 'source:b']);
  assert.deepEqual(snapshots.at(-1).pending, []);
});

test('late earlier-ranked results preserve the exact selected address, not its old index', async () => {
  const first = deferred(), second = deferred(), snapshots = [];
  progressiveSearch(() => first.promise, () => second.promise, value => snapshots.push(value));
  second.resolve({hits: [hit('source:later', 'Same title')], absences: []});
  await settle();
  const selected = searchKeys(snapshots.at(-1).hits, [])[0];
  first.resolve({hits: [hit('source:earlier', 'Same title')], absences: []});
  await settle();
  assert.equal(preserveSearchSelection(selected, snapshots.at(-1).hits, []), 1);
  assert.equal(snapshots.at(-1).hits.length, 2, 'identical labels are not identities');
});

test('failure and cancellation cannot erase another provider or publish an obsolete query', async () => {
  const first = deferred(), second = deferred(), snapshots = [], stop = new AbortController();
  progressiveSearch(() => first.promise, () => second.promise, value => snapshots.push(value), stop.signal);
  first.reject(new Error('offline search'));
  second.resolve({hits: [hit('source:still-usable')], absences: []});
  await settle();
  assert.equal(snapshots.at(-1).error, 'offline search');
  assert.equal(snapshots.at(-1).hits[0].resource, 'source:still-usable');
  const old = deferred(), ignored = [];
  progressiveSearch(() => old.promise, () => old.promise, value => ignored.push(value), stop.signal);
  const before = ignored.length;
  stop.abort(); old.resolve({hits: [hit('source:obsolete')], absences: []});
  await settle();
  assert.equal(ignored.length, before);
});

test('equivalent reads join, but cancelling one consumer keeps the other alive', async () => {
  const queue = new KnowledgeReadCoordinator(1), native = deferred(), stop = new AbortController();
  let calls = 0;
  const run = () => { calls++; return native.promise; };
  const a = queue.read('same', run, stop.signal), b = queue.read('same', run);
  const rejected = assert.rejects(a, {name: 'AbortError'});
  stop.abort(); native.resolve('owner reading');
  await rejected;
  assert.equal(await b, 'owner reading');
  assert.equal(calls, 1);
  await settle();
  assert.deepEqual(queue.inspect(), {active: 0, waiting: 0, distinct: 0});
  assert.equal(await queue.read('same', async () => 'new owner reading'), 'new owner reading', 'coordinator does not retain a shadow content cache');
});

test('cancelled queued queries never invoke native work and all concurrency is bounded', async () => {
  const queue = new KnowledgeReadCoordinator(1, 2), active = deferred(), stop = new AbortController();
  const a = queue.read('a', () => active.promise);
  let discardedCalls = 0;
  const b = queue.read('b', async () => { discardedCalls++; }, stop.signal);
  const rejected = assert.rejects(b, {name: 'AbortError'});
  stop.abort();
  const c = queue.read('c', async () => 'current');
  assert.deepEqual(queue.inspect(), {active: 1, waiting: 1, distinct: 2});
  active.resolve('a');
  assert.equal(await a, 'a'); assert.equal(await c, 'current'); await rejected;
  assert.equal(discardedCalls, 0);
});

test('queue failures release slots; read keys do not merge worlds and use effects are never deduplicated', async () => {
  const queue = new KnowledgeReadCoordinator(1, 1);
  await assert.rejects(queue.read('broken', () => { throw new Error('transport'); }), /transport/);
  assert.equal(await queue.read('healthy', async () => 1), 1);
  const original = globalThis.fetch, calls = [], answer = deferred();
  globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); await answer.promise; return {json: async () => ({ok: true, outcome: {result: 'knowledge', data: {resource: 'r'}}})}; };
  try {
    const transport = {kind: 'bridge', url: 'http://controlled.invalid'};
    const reads = [knowledge(transport, 'A', {action: 'read', address: {kind: 'wiki', value: 'r'}}), knowledge(transport, 'A', {action: 'read', address: {kind: 'wiki', value: 'r'}}), knowledge(transport, 'B', {action: 'read', address: {kind: 'wiki', value: 'r'}})];
    const uses = [knowledge(transport, 'A', {action: 'use', address: {kind: 'wiki', value: 'r'}}), knowledge(transport, 'A', {action: 'use', address: {kind: 'wiki', value: 'r'}})];
    await settle(); answer.resolve(); await Promise.all([...reads, ...uses]);
    assert.equal(calls.filter(call => call.request.action === 'read').length, 2);
    assert.equal(calls.filter(call => call.request.action === 'use').length, 2);
  } finally { globalThis.fetch = original; }
});
