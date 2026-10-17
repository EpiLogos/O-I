/** Lane W3: a replay pull the client aborted is reported as aborted, never as the kernel's refusal. The B0 investigator
 * traced the 15 Oct "Kernel replay refused (200)" to the browser's own failed body read: the 10 s bound fired while the body
 * streamed, `.json().catch(() => ({}))` turned that into an empty body, and the empty body read as a refusal with status 200.
 * Channel: scripted over a stubbed fetch (the dev bridge transport); the native transport has no body to read. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {eventReplay, ReplayAborted, ReplayServiceAbsent, replayAborted, REPLAY_TIMEOUT_MS} from '../src/kernel/bridge.ts';

const transport = {kind: 'bridge', url: 'http://bridge.test/replay'};
const page = {schema: 'oi.kernel-event-replay/v1', generation: 'g1', oldest_seq: null, latest_seq: 0, next_seq: 1,
  resync_required: false, has_more: false, receipts: []};

/** A stubbed bridge whose response body is read through `json` (a thunk given the request's signal). */
function stub(status, json) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).startsWith(transport.url));
    return {status, ok: status >= 200 && status < 300, json: () => json(init.signal)};
  };
  return () => { globalThis.fetch = original; };
}

/** A body that never arrives: it rejects as the platform does when the request's signal aborts mid-stream. */
const stalled = signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')), {once: true}));

test('a body read the caller aborts is ReplayAborted(caller), not "Kernel replay refused (200)"', async () => {
  const restore = stub(200, stalled);
  try {
    const caller = new AbortController();
    setTimeout(() => caller.abort(), 20);
    const error = await eventReplay(transport, 1, undefined, 128, caller.signal).then(() => null, error => error);
    assert.ok(error instanceof ReplayAborted, String(error));
    assert.equal(error.origin, 'caller');
    assert.doesNotMatch(String(error), /refused/);
  } finally { restore(); }
});

test('the pull\'s own time bound is named as the timeout, the caller\'s abort as the caller', async () => {
  const caller = new AbortController();
  const timeout = AbortSignal.timeout(1);
  const request = AbortSignal.any([caller.signal, timeout]);
  assert.equal(replayAborted(request, timeout, caller.signal), null, 'nothing aborted yet');
  await new Promise(resolve => setTimeout(resolve, 20));
  const timedOut = replayAborted(request, timeout, caller.signal);
  assert.ok(timedOut instanceof ReplayAborted);
  assert.equal(timedOut.origin, 'timeout');
  assert.match(timedOut.message, new RegExp(`${REPLAY_TIMEOUT_MS} ms`));
  const mine = new AbortController();
  mine.abort();
  assert.equal(replayAborted(AbortSignal.any([mine.signal]), AbortSignal.timeout(60_000), mine.signal).origin, 'caller');
});

test('an unreadable body that nobody aborted is named unreadable with its status', async () => {
  const restore = stub(200, async () => { throw new SyntaxError('Unexpected end of JSON input'); });
  try {
    const error = await eventReplay(transport).then(() => null, error => error);
    assert.ok(error instanceof Error && !(error instanceof ReplayAborted));
    assert.match(String(error), /Kernel replay unreadable \(200\)/);
  } finally { restore(); }
});

test('the kernel\'s own refusal stays a refusal in its own words, and an absent route stays absent', async () => {
  let restore = stub(200, async () => ({ok: false, error: 'event replay cursor and limit must be positive'}));
  try {
    await assert.rejects(eventReplay(transport), /event replay cursor and limit must be positive/);
  } finally { restore(); }
  restore = stub(500, async () => ({}));
  try {
    await assert.rejects(eventReplay(transport), /Kernel replay refused \(500\)/);
  } finally { restore(); }
  restore = stub(404, async () => { throw new SyntaxError('not JSON'); });
  try {
    await assert.rejects(eventReplay(transport), error => error instanceof ReplayServiceAbsent);
  } finally { restore(); }
  restore = stub(200, async () => ({ok: true, replay: page}));
  try {
    assert.deepEqual(await eventReplay(transport), page);
  } finally { restore(); }
});
