// A "superseded" refusal from the kernel's read-ticket law (see
// requests.ts's resource serialisation for the same-realm case it fully
// prevents) can still come from a genuinely separate reader of the identical
// owner resource outside this JS realm — another window or iframe sharing
// the same kernel over the same bridge, which this module's coordinator has
// no way to see or serialise against. A single retry can itself lose that
// residual race. knowledge() now makes a small, BOUNDED number of attempts
// (never infinite) before giving up honestly.
import test from 'node:test';
import assert from 'node:assert/strict';
import {knowledge} from '../src/knowledge/client.ts';

const transport = {kind: 'bridge', url: 'http://controlled.invalid'};
const reading = {resource: 'source:a', revision: 'r1', content: 'hi', authority: 'observed', provider: 'ai-kit', evidence: []};
function stubFetch(responses) {
  const original = globalThis.fetch;
  let calls = 0;
  const bodies = [];
  globalThis.fetch = async (_url, options) => {
    const op = JSON.parse(options.body);
    bodies.push(op);
    const outcome = responses[Math.min(calls, responses.length - 1)];
    calls++;
    return {json: async () => outcome};
  };
  return {restore: () => { globalThis.fetch = original; }, calls: () => calls, bodies};
}
const ok = () => ({ok: true, outcome: {result: 'knowledge', data: reading}});
const superseded = () => ({ok: false, error: 'Knowledge read was superseded or its source scope was invalidated; read again'});

test('a superseded read that recovers on the very next attempt succeeds transparently', async () => {
  const stub = stubFetch([superseded(), ok()]);
  try {
    const value = await knowledge(transport, 'Notes', {action: 'read', address: {kind: 'source', value: 'source:a'}});
    assert.equal(value.resource, 'source:a');
    assert.equal(stub.calls(), 2);
    assert.equal(stub.bodies[1].fresh, true, 'a retry forces a fresh basis');
  } finally { stub.restore(); }
});

test('a superseded read that loses TWICE (e.g. a separate reader outside this realm) still recovers within the bounded attempt budget', async () => {
  const stub = stubFetch([superseded(), superseded(), ok()]);
  try {
    const value = await knowledge(transport, 'Notes', {action: 'read', address: {kind: 'source', value: 'source:a'}});
    assert.equal(value.resource, 'source:a');
    assert.equal(stub.calls(), 3);
  } finally { stub.restore(); }
});

test('exhausting the bounded attempt budget still fails honestly — never an infinite retry loop', async () => {
  const stub = stubFetch([superseded()]);
  try {
    await assert.rejects(
      knowledge(transport, 'Notes', {action: 'read', address: {kind: 'source', value: 'source:a'}}),
      /superseded/,
    );
    assert.equal(stub.calls(), 3, 'bounded: a fixed attempt budget, not unbounded');
  } finally { stub.restore(); }
});

test('a genuinely different (non-superseded) refusal is never retried and reports immediately', async () => {
  const stub = stubFetch([{ok: false, error: 'The selected passage has inconsistent source identity.'}]);
  try {
    await assert.rejects(
      knowledge(transport, 'Notes', {action: 'read', address: {kind: 'source', value: 'source:a'}}),
      /inconsistent source identity/,
    );
    assert.equal(stub.calls(), 1, 'an unrelated refusal is reported honestly, not masked by a retry loop');
  } finally { stub.restore(); }
});
