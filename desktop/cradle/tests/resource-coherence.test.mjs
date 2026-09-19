// Resource coherence: the shared file broker (src/files/resources.ts) and the
// listing store's generations (src/files/listingStore.ts), driven against a
// real mock owner over HTTP — the same wire the bridge transport speaks
// (src/kernel/bridge.ts kernelOp: POST /op with a typed KernelOp).
// Run: node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/resource-coherence.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';

const {acquireFileReading, acquireFileBytes, peekFileReading, peekFileBytes, peekFileState, invalidateFile, applyReceipt, resourceStats} = await import('../src/files/resources.ts');
const {ListingStore} = await import('../src/files/listingStore.ts');

const location = (ref, path, root = 'central') => ({schema: 'central.path-ref/v1', ref, root, path});

let ownerSerial = 0;
/** One mock Central owner: counts every kernelOp POST it receives, answers
 * the file ops with distinguishable readings, and lets a test hold responses
 * (per-request release handles) or override them (a FIFO plan) so races and
 * failures are deterministic. */
async function startOwner() {
  const id = ++ownerSerial;
  const requests = [];   // parsed ops, arrival order
  const held = [];       // while holding: {op, release} per arrived request
  const plan = [];       // FIFO response overrides: body or (op, n) => body
  const dirReads = new Map(); // per-path read counter, so each listing names itself
  const waiters = [];
  let holding = false;
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', async () => {
      const op = JSON.parse(raw);
      requests.push(op);
      for (const waiter of [...waiters]) if (requests.length >= waiter.n) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(); }
      const n = requests.length;
      let body = plan.length ? plan.shift() : defaultOutcome(op, n);
      if (typeof body === 'function') body = body(op, n);
      if (holding) await new Promise(resolve => held.push({op, release: resolve}));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(body));
    });
  });
  const defaultOutcome = (op, n) => {
    if (op.op === 'files_list') {
      const count = (dirReads.get(op.path) ?? 0) + 1;
      dirReads.set(op.path, count);
      return {ok: true, outcome: {result: 'directory_read', directory: {schema: 'central.directory-reading/v1', location: location(`dir:${op.path}@${count}`, op.path), entries: [], automatic_agent_or_model_invocation: false}}};
    }
    if (op.op === 'file_read') {
      return {ok: true, outcome: {result: 'file_read', reading: {schema: 'central.file-reading/v1', location: op.location, revision: `rev-${id}-${n}`, byte_len: 8, content_encoding: 'utf-8', content: `content ${n}`, project: null, source: null}}};
    }
    if (op.op === 'file_bytes') {
      return {ok: true, outcome: {result: 'file_bytes', location: op.location, revision: `rev-${id}-${n}`, byte_len: 4, mime_hint: 'application/octet-stream', content_base64: Buffer.from('raw!').toString('base64')}};
    }
    return {ok: false, error: `the mock owner does not answer ${op.op}`};
  };
  const port = await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  return {
    requests, plan, held,
    transport: {kind: 'bridge', url: `http://127.0.0.1:${port}`},
    hold() { holding = true; },
    resume() { holding = false; },
    drain() { while (held.length) held.shift().release(); },
    waitForCount(n) {
      if (requests.length >= n) return Promise.resolve();
      return new Promise(resolve => waiters.push({n, resolve}));
    },
    close() {
      server.closeAllConnections();
      return new Promise(resolve => server.close(resolve));
    },
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function settle(probe, label = 'condition') {
  for (let waited = 0; waited < 200; waited++) {
    if (probe()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error(`timed out waiting for ${label}`);
}

test('C06: three concurrent acquisitions of one location join ONE owner read', async () => {
  const owner = await startOwner();
  try {
    await owner.hold();
    const loc = location('oi:test/join.md', 'join.md');
    const before = resourceStats();
    const three = [
      acquireFileReading(owner.transport, loc),
      acquireFileReading(owner.transport, loc),
      acquireFileReading(owner.transport, loc),
    ];
    await owner.waitForCount(1);
    assert.equal(owner.requests.length, 1, 'the join happens before anything reaches the owner');
    owner.drain();
    const readings = await Promise.all(three);
    assert.equal(owner.requests.length, 1, 'still exactly one owner POST');
    assert.equal(resourceStats().acquisitions, before.acquisitions + 1);
    assert.equal(resourceStats().joined, before.joined + 2, 'two consumers joined the shared read');
    assert.equal(resourceStats().cache_hits, before.cache_hits);
    for (const reading of readings) {
      assert.deepEqual(reading, readings[0], 'every consumer resolves to the same reading');
      assert.equal(reading.location.ref, 'oi:test/join.md');
    }
  } finally { await owner.close(); }
});

test('a resolved reading serves later acquisitions with no owner round trip', async () => {
  const owner = await startOwner();
  try {
    const loc = location('oi:test/hit.md', 'hit.md');
    const first = await acquireFileReading(owner.transport, loc);
    const before = resourceStats();
    const second = await acquireFileReading(owner.transport, loc);
    assert.equal(owner.requests.length, 1, 'no second POST');
    assert.equal(second, first, 'the cache serves the resident reading itself');
    assert.equal(resourceStats().cache_hits, before.cache_hits + 1);
    assert.equal(resourceStats().acquisitions, before.acquisitions);
  } finally { await owner.close(); }
});

test('distinct refs, distinct paths and distinct epochs never join or share', async () => {
  const ownerA = await startOwner();
  const ownerB = await startOwner(); // a different bridge URL is a different access epoch
  try {
    const refOne = location('oi:test/one.md', 'same.md');
    const refOther = location('oi:test/other.md', 'same.md'); // distinct ref, same path
    const bareA = location('', 'a.md'); // no ref: the root+path fallback keys it
    const bareB = location('', 'b.md');
    const [r1, r2, r3, r4, r5] = await Promise.all([
      acquireFileReading(ownerA.transport, refOne),
      acquireFileReading(ownerA.transport, refOther),
      acquireFileReading(ownerA.transport, bareA),
      acquireFileReading(ownerA.transport, bareB),
      acquireFileReading(ownerB.transport, refOne), // same location, other epoch
    ]);
    assert.equal(ownerA.requests.length, 4, 'four distinct subjects, four reads on one epoch');
    assert.equal(ownerB.requests.length, 1, 'the other epoch read for itself');
    assert.equal(new Set([r1.revision, r2.revision, r3.revision, r4.revision, r5.revision]).size, 5, 'no entry answered for another');
    const before = resourceStats();
    const again = await acquireFileReading(ownerA.transport, refOne);
    assert.equal(again, r1, 'a later acquire hits its own epoch\'s entry only');
    assert.equal(ownerA.requests.length, 4);
    assert.equal(ownerB.requests.length, 1);
    assert.equal(resourceStats().acquisitions, before.acquisitions);
    assert.equal(resourceStats().cache_hits, before.cache_hits + 1);
  } finally { await ownerA.close(); await ownerB.close(); }
});

test('text and bytes for the same file are separate entries (two POSTs)', async () => {
  const owner = await startOwner();
  try {
    const loc = location('oi:test/both.md', 'both.md');
    const reading = await acquireFileReading(owner.transport, loc);
    const bytes = await acquireFileBytes(owner.transport, loc);
    assert.equal(owner.requests.length, 2);
    assert.equal(owner.requests[0].op, 'file_read');
    assert.equal(owner.requests[1].op, 'file_bytes');
    assert.equal(peekFileReading(loc)?.revision, reading.revision);
    assert.equal(peekFileBytes(loc)?.revision, bytes.revision);
    assert.notEqual(reading.revision, bytes.revision, 'the two operation classes never share an entry');
  } finally { await owner.close(); }
});

test('invalidation while a read is in flight drops its result; the next acquire re-reads', async () => {
  const owner = await startOwner();
  try {
    await owner.hold();
    const loc = location('oi:test/stale.md', 'stale.md');
    const before = resourceStats();
    const first = acquireFileReading(owner.transport, loc);
    await owner.waitForCount(1);
    invalidateFile(loc);
    assert.equal(resourceStats().invalidations, before.invalidations + 1);
    owner.drain();
    const staleReading = await first;
    assert.equal(peekFileReading(loc), undefined, 'the late result was not published as ready');
    assert.equal(peekFileState(loc)?.status, 'loading', 'the entry tombstones for the next read');
    assert.equal(resourceStats().stale_dropped, before.stale_dropped + 1, 'the guard counted the drop');
    owner.resume();
    const second = await acquireFileReading(owner.transport, loc);
    assert.equal(owner.requests.length, 2, 'the next acquire started a real new read');
    assert.notEqual(second.revision, staleReading.revision);
    assert.equal(peekFileReading(loc)?.revision, second.revision);
  } finally { await owner.close(); }
});

test('applyReceipt: file_changed drops the subject; other events, malformed paths and replayed seqs do not', async () => {
  const owner = await startOwner();
  try {
    const loc = location('oi:test/receipt.md', 'receipt.md');
    await acquireFileReading(owner.transport, loc);
    assert.equal(peekFileState(loc)?.status, 'ready');
    applyReceipt({event: 'expression_changed', seq: 4, path: 'receipt.md'});
    assert.equal(peekFileState(loc)?.status, 'ready', 'an unrelated receipt never drops a reading');
    applyReceipt({event: 'file_changed', seq: 4, path: 'receipt.md'});
    assert.equal(peekFileState(loc)?.status, 'loading', 'file_changed tombstoned the entry');
    assert.ok(peekFileReading(loc), 'the last reading stays visible through the tombstone');
    const again = await acquireFileReading(owner.transport, loc);
    assert.equal(owner.requests.length, 2, 'the receipt forced a real re-read');
    assert.equal(peekFileState(loc)?.status, 'ready');
    const before = resourceStats();
    applyReceipt({event: 'file_changed', seq: 4, path: 'receipt.md'});
    assert.equal(resourceStats().invalidations, before.invalidations, 'a replayed seq is deduped');
    applyReceipt({event: 'file_changed', seq: 5, path: 42});
    applyReceipt({event: 'file_changed', seq: 6});
    assert.equal(resourceStats().invalidations, before.invalidations, 'a non-string or absent path is ignored, not thrown on');
    assert.equal(peekFileReading(loc)?.revision, again.revision);
  } finally { await owner.close(); }
});

test('C12: a slow ordinary completion never overwrites a newer fresh refresh', async () => {
  const owner = await startOwner();
  try {
    await owner.hold();
    const store = new ListingStore();
    const path = 'docs';
    store.ensure(owner.transport, path, false);
    await owner.waitForCount(1);
    owner.drain();
    await settle(() => store.entry(path).status === 'ready', 'the first listing');
    const first = store.entry(path).reading;
    assert.equal(first.location.ref, 'dir:docs@1');
    // A receipt invalidates the parent ("docs"), the mounted directory
    // re-reads ordinarily, and the person hits refresh mid-flight — the
    // exact production sequence this store must survive.
    store.invalidateParentOf('docs/file.md');
    assert.equal(store.entry(path).status, 'pending');
    assert.equal(store.entry(path).reading, first, 'BOOT-14: the last listing stays visible while pending');
    store.ensure(owner.transport, path, false);
    await owner.waitForCount(2);
    store.ensure(owner.transport, path, true); // supersedes the ordinary read in flight
    await owner.waitForCount(3);
    assert.equal(store.entry(path).status, 'pending');
    assert.equal(store.entry(path).reading, first, 'still visible while the fresh read runs');
    assert.equal(owner.requests[1].fresh, undefined, 'the ordinary read went out ordinary');
    assert.equal(owner.requests[2].fresh, true, 'the refresh went out fresh');
    owner.held[1].release(); // held[0] is the ordinary read; the FRESH one completes first
    await settle(() => store.entry(path).status === 'ready', 'the fresh listing');
    const fresh = store.entry(path).reading;
    assert.equal(fresh.location.ref, 'dir:docs@3', 'the fresh listing published');
    owner.held[0].release(); // the ordinary read completes LATE
    await tick();
    assert.equal(store.entry(path).status, 'ready');
    assert.equal(store.entry(path).reading, fresh, 'the late ordinary completion did not roll the listing back');
    assert.equal(store.staleDropped(), 1, 'the stale completion was counted, never applied');
    store.ensure(owner.transport, path, false);
    await tick();
    assert.equal(owner.requests.length, 3, 'the fresh listing is the admitted cache entry afterwards');
  } finally { await owner.close(); }
});

test('C10: a failed refresh keeps the last listing on the entry beside the error', async () => {
  const owner = await startOwner();
  try {
    const store = new ListingStore();
    const path = 'gallery';
    store.ensure(owner.transport, path, false);
    await settle(() => store.entry(path).status === 'ready', 'the first listing');
    const good = store.entry(path).reading;
    owner.plan.push(() => ({ok: false, error: 'owner refused the listing'}));
    store.ensure(owner.transport, path, true);
    await settle(() => store.entry(path).status === 'error', 'the failed refresh');
    const entry = store.entry(path);
    assert.equal(entry.status, 'error');
    assert.equal(entry.reading, good, 'the last listing stays on the entry (status error + reading present)');
    assert.match(entry.error, /owner refused/);
  } finally { await owner.close(); }
});

test('C10: a failed re-read keeps the previous reading on the broker entry', async () => {
  const owner = await startOwner();
  try {
    const loc = location('oi:test/c10.md', 'c10.md');
    const good = await acquireFileReading(owner.transport, loc);
    owner.plan.push(() => ({ok: false, error: 'owner refused the read'}));
    invalidateFile(loc);
    assert.equal(peekFileState(loc)?.status, 'loading');
    assert.equal(peekFileState(loc)?.reading, good, 'the tombstone keeps the reading');
    await assert.rejects(acquireFileReading(owner.transport, loc), /owner refused/);
    const state = peekFileState(loc);
    assert.equal(state.status, 'error');
    assert.equal(state.reading, good, 'C10: error status with the last reading present');
    assert.equal(peekFileReading(loc), good, 'consumers still see the last reading');
  } finally { await owner.close(); }
});

test('switching the workspace key releases every listing (the release law)', async () => {
  const owner = await startOwner();
  try {
    const store = new ListingStore();
    const path = 'inbox';
    store.ensure(owner.transport, path, false);
    await settle(() => store.entry(path).status === 'ready', 'the first listing');
    store.setActiveWorkspace('work-2');
    const entry = store.entry(path);
    assert.deepEqual(entry, {status: 'pending', rev: 0}, 'the released listing is gone, not stale-admitted');
    store.ensure(owner.transport, path, false);
    await owner.waitForCount(2);
    owner.drain();
    await settle(() => store.entry(path).status === 'ready', 'the re-read listing');
    assert.equal(store.entry(path).reading.location.ref, 'dir:inbox@2', 'the new workspace read for itself');
  } finally { await owner.close(); }
});
