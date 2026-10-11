/** Read-only, source-bound native recovery acceptance through the actual
 * retained controller and MessageChannel. No personal journal writes, opens,
 * migration, pending replay or native DOM/craft claim. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ExpressionsHost} from '../src/host.ts';
import {RecoveryAdmission} from '../src/recoveryBinding.ts';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge.ts';
import {messageWire} from './message-wire.mjs';

const flag = process.argv.indexOf('--kernel-url');
if (flag < 0 || !process.argv[flag + 1]) throw Error('Pass the explicit native owner with --kernel-url');
const configFlag = process.argv.indexOf('--config-url');
if (configFlag < 0 || !process.argv[configFlag + 1]) throw Error('Pass the candidate native work configuration with --config-url');
const transport = {kind: 'bridge', url: process.argv[flag + 1]};
const response = await fetch(process.argv[configFlag + 1]);
assert.equal(response.ok, true);
const config = await response.json();
assert.ok(Array.isArray(config.saved_works) && config.saved_works.length >= 2);
const bindings = config.saved_works.map(({scope, checkpoint_id, expression_ref}) => ({scope, checkpoint_id, expression_ref}));
assert.ok(bindings.some(row => row.scope === 'techne'));
assert.ok(bindings.some(row => row.scope === 'expressions'));
const admitted = new RecoveryAdmission(bindings), actual = new Map();
const readOwner = async request => {
  assert.ok(['read', 'list'].includes(request.operation), 'This acceptance never dispatches a personal mutation');
  const call = await kernelOp(transport, {op: 'expression_recovery', request});
  assert.equal(call.error, undefined, call.error);
  assert.equal(call.outcome?.result, 'expression_recovery');
  return call.outcome.data;
};
for (const binding of bindings) {
  const request = {operation: 'read', scope: binding.scope, kind: 'checkpoint', id: binding.checkpoint_id};
  const result = await readOwner(request);
  admitted.acknowledge(request, result, admitted.admit(request));
  assert.ok(result.record, 'The chosen native work must actually exist');
  actual.set(binding.expression_ref, result.record);
}
const origin = 'http://127.0.0.1:8788', wire = messageWire(), frame = new EventTarget();
frame.src = `${origin}/__application/expressions/index.html?mode=techne`;
frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
frame.closest = () => null;
const calls = [], host = new ExpressionsHost(frame, {bindingId: 'native-recovery-acceptance',
  // Successful continuation results carry extra owner-basis metadata; only
  // the three selected address fields may cross the open/refresh carrier.
  recoveryBindings: bindings.map(binding => ({...binding, storage_revision: actual.get(binding.expression_ref).revision,
    document_revision: actual.get(binding.expression_ref).value.view.document.revision,
    pending_retained: actual.get(binding.expression_ref).value.pending != null})),
  initialRecoveryBinding: bindings[0], messageTarget: new EventTarget(),
  owners: {channels: {'expression-recovery': async request => {calls.push(request); return readOwner(request);}}}});
let serial = 0, checks = 0;
const request = async value => {
  const req = ++serial;
  await host.handleMessage({source: frame.contentWindow, origin, data: {v: 1, kind: 'expression-recovery', req, request: value}});
  const reply = (await wire.observe()).find(row => row.kind === 'expression-recovery-result' && row.req === req);
  assert.ok(reply, 'A valid-origin request receives one correlated acknowledgement/refusal');
  return reply;
};
try {
  const url = frame.src, deep = bindings.find(row => row.scope === 'techne'), authored = bindings.find(row => row.scope === 'expressions');
  const deepRecord = actual.get(deep.expression_ref);
  let reply = await request({operation: 'read', scope: deep.scope, kind: 'draft', id: deepRecord.value.draft_id});
  assert.equal(reply.ok, false); assert.equal(calls.length, 0); checks++;
  reply = await request({operation: 'write', scope: deep.scope, kind: 'checkpoint', id: deep.checkpoint_id,
    expected_revision: deepRecord.revision, value: deepRecord.value});
  assert.equal(reply.ok, false); assert.equal(calls.length, 0, 'A checkpoint write cannot precede proof of its exact draft address'); checks++;
  host.setMode('expressions');
  reply = await request({operation: 'read', scope: deep.scope, kind: 'checkpoint', id: deep.checkpoint_id});
  assert.equal(reply.ok, true); assert.equal(reply.data.record.scope, 'techne');
  assert.deepEqual(reply.data.record.value.view.document, deepRecord.value.view.document); checks++;
  reply = await request({operation: 'read', scope: deep.scope, kind: 'draft', id: deepRecord.value.draft_id});
  assert.equal(reply.ok, true); assert.equal(calls.at(-1).scope, deep.scope); checks++;
  // Exercise write admission using actual owner bytes/basis, without calling
  // the journal's write operation. Successful write execution is not claimed.
  const heldWrite = {operation: 'write', scope: deep.scope, kind: 'checkpoint', id: deep.checkpoint_id,
    expected_revision: deepRecord.revision, value: deepRecord.value};
  assert.deepEqual(admitted.admit(heldWrite), deep); checks++;
  assert.throws(() => admitted.admit({...heldWrite, value: {...deepRecord.value, draft_id: 'unproved-draft-id'}}), /selected native work/); checks++;
  const beforeRefusal = calls.length;
  reply = await request({operation: 'read', scope: 'expressions', kind: 'checkpoint', id: deep.checkpoint_id});
  assert.equal(reply.ok, false); assert.equal(calls.length, beforeRefusal); checks++;
  reply = await request({operation: 'find_checkpoint', scope: authored.scope, expression_ref: authored.expression_ref});
  assert.equal(reply.ok, false); assert.match(reply.error, /exact id/); assert.equal(calls.length, beforeRefusal); checks++;
  host.setMode('techne');
  reply = await request({operation: 'read', scope: authored.scope, kind: 'checkpoint', id: authored.checkpoint_id});
  assert.equal(reply.ok, true); assert.equal(reply.data.record.scope, 'expressions'); checks++;
  reply = await request({operation: 'list', scope: authored.scope, kind: 'checkpoint'});
  assert.equal(reply.ok, true);
  assert.deepEqual(reply.data.records.map(row => row.id).sort(), bindings.filter(row => row.scope === authored.scope).map(row => row.checkpoint_id).sort()); checks++;
  assert.throws(() => host.openExpression('expression:unconfigured', 'native-recovery-acceptance'), /host-selected recovery address/);
  assert.equal(frame.src, url); checks++;
  const document = deepRecord.value.view.document;
  await host.handleMessage({source: frame.contentWindow, origin, data: {v: 1, kind: 'oi-app-state', state: {
    hostMode: 'techne', sceneCount: document.scenes.length,
    document: {id: document.expression_ref, name: document.title},
    nativeScene: {expression_ref: document.expression_ref, revision: document.revision, scene_ref: document.selection.scene_ref},
  }}});
  host.openExpression(authored.expression_ref, 'native-recovery-acceptance');
  host.openExpression(deep.expression_ref, 'native-recovery-acceptance', {refresh: true});
  const commands = (await wire.observe()).filter(row => row.command === 'open-expression' || row.command === 'refresh-expression');
  assert.deepEqual(commands.map(row => row.recovery), [authored, deep]); checks++;
  const requestDeep = {operation: 'read', scope: deep.scope, kind: 'checkpoint', id: deep.checkpoint_id};
  const truthful = {schema: 'oi.expression-recovery/v1', state: 'ready', record: deepRecord};
  // Corrupt only the transport envelope of a genuine owner reading. This is
  // a boundary refusal check; it is not evidence of an actual native fault.
  assert.throws(() => admitted.acknowledge(requestDeep, {...truthful, record: {...deepRecord, scope: 'expressions'}}, deep), /requested scope/); checks++;
  console.log(JSON.stringify({grade: 'B', kernel_url: transport.url, passed: checks, faults: 0,
    claim: 'read-only native recovery routing remains selected-address-bound across both cuts; unselected scope/ref and mismatched ack refuse',
    mutations_dispatched: 0, records: bindings.map(binding => {
      const record = actual.get(binding.expression_ref), document = record.value.view.document;
      return {...binding, storage_revision: record.revision, document_revision: document.revision,
        pending_retained: record.value.pending?.kind ?? null,
        document_sha256: createHash('sha256').update(JSON.stringify(document)).digest('hex')};
    })}));
} finally {host.dispose(); wire.dispose();}
