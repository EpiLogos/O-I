// Regression: WikiConstructionPanel mounts `read()` (the register) and
// `authoringForms()` (the QL Frame catalogue) concurrently. authoringForms
// reads through the `graph` op, which never participates in the kernel's
// read-ticket law (kernel/src/lib.rs KernelOp::Graph — no begin()/finish());
// it cannot be "superseded". But the native AIKit resolution it assembles
// from can still come back genuinely, transiently unavailable under owner
// contention with the concurrent register/source reads — the graph op
// itself still answers `ok:true`, with `inputs.aikit_resolution.state`
// reporting the unavailability honestly rather than throwing. A caller that
// only reacted to a thrown rejection silently dropped QL frames: the Frame
// select fell back to "Open arrangement · no QL required" with no retry and
// no honest notice (the observed native-walk failure: the option list never
// populated). authoringForms now retries a bounded number of times, forcing
// a fresh basis each retry, before genuinely giving up.
import test from 'node:test';
import assert from 'node:assert/strict';
import {authoringForms} from '../src/knowledge/construction.ts';

const transport = {kind: 'bridge', url: 'http://controlled.invalid'};
const catalogue = {schema: 'aikit.ql-authoring-forms/v1', forms: [{id: 'ql:authoring:twofold', label: 'Twofold', shape_ref: 'ql:shape:1.0.0:constellation:twofold', contract_ref: 'ql.shape@1.0.0', roles: [{role_ref: 'role:0', label: '0', address: {}}, {role_ref: 'role:1', label: '1', address: {}}], provenance: [], standing: 'proposed'}]};
const graphReading = (resolution) => ({
  schema: 'oi.cradle.graph-reading/v1', nodes: [], edges: [], counts: {spaces: 0, wiki_nodes: 0, knowledge_rows: 0, nodes: 0, edges: 0},
  inputs: {central_wiki: {state: 'unavailable', owner_operation: 'x', detail: 'unused'}, aikit_resolution: resolution, shared_field: {state: 'unavailable', owner_operation: 'x', detail: 'unused'}},
  shape_catalog: resolution.state === 'available' ? catalogue : undefined,
});
function stubFetch(responses) {
  const original = globalThis.fetch;
  let calls = 0;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    const op = JSON.parse(options.body);
    requests.push(op);
    const reading = responses[Math.min(calls, responses.length - 1)];
    calls++;
    return {json: async () => ({ok: true, outcome: {result: 'graph_reading', reading}})};
  };
  return {restore: () => { globalThis.fetch = original; }, calls: () => calls, requests};
}

test('a transiently unavailable native resolution is retried and eventually served', async () => {
  const stub = stubFetch([
    graphReading({state: 'unavailable', owner_operation: 'aikit.resolution', detail: 'owner busy'}),
    graphReading({state: 'unavailable', owner_operation: 'aikit.resolution', detail: 'owner busy'}),
    graphReading({state: 'available', owner_operation: 'aikit.resolution'}),
  ]);
  try {
    const forms = await authoringForms(transport, 'Notes');
    assert.equal(forms.length, 1);
    assert.equal(forms[0].id, 'ql:authoring:twofold');
    assert.equal(stub.calls(), 3, 'two transient refusals plus the succeeding attempt');
    assert.equal(stub.requests[0].options.fresh, false, 'the first attempt does not force fresh');
    assert.equal(stub.requests[1].options.fresh, true, 'a retry forces a fresh basis — a transient refusal is never cached over');
    assert.equal(stub.requests[2].options.fresh, true);
  } finally { stub.restore(); }
});

test('an immediately available reading is never retried', async () => {
  const stub = stubFetch([graphReading({state: 'available', owner_operation: 'aikit.resolution'})]);
  try {
    const forms = await authoringForms(transport, 'Notes');
    assert.equal(forms.length, 1);
    assert.equal(stub.calls(), 1);
  } finally { stub.restore(); }
});

test('exhausting every retry is a genuine, bounded, honestly-reported failure — never an infinite loop, never a silent empty catalogue', async () => {
  const stub = stubFetch([graphReading({state: 'unavailable', owner_operation: 'aikit.resolution', detail: 'owner still busy'})]);
  try {
    await assert.rejects(authoringForms(transport, 'Notes'), /owner still busy/);
    assert.equal(stub.calls(), 3, 'bounded: exactly the fixed attempt budget, not unbounded');
  } finally { stub.restore(); }
});

test('a genuinely absent/malformed catalogue on an available reading still yields an honest empty list, not a thrown error', async () => {
  const stub = stubFetch([{
    schema: 'oi.cradle.graph-reading/v1', nodes: [], edges: [], counts: {spaces: 0, wiki_nodes: 0, knowledge_rows: 0, nodes: 0, edges: 0},
    inputs: {central_wiki: {state: 'unavailable', owner_operation: 'x', detail: 'unused'}, aikit_resolution: {state: 'available', owner_operation: 'aikit.resolution'}, shared_field: {state: 'unavailable', owner_operation: 'x', detail: 'unused'}},
    shape_catalog: undefined,
  }]);
  try {
    assert.deepEqual(await authoringForms(transport, 'Notes'), []);
    assert.equal(stub.calls(), 1, 'the resolution genuinely was available; an empty catalogue is not retried as if it were a refusal');
  } finally { stub.restore(); }
});
