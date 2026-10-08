/** Real native owner read/open acceptance. Transport-grade only: the retained
 * controller uses a MessageChannel aperture; native DOM/craft is tested by the
 * parent's computer-use replay. No fixture knowledge or native success data. */
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {createHash} from 'node:crypto';
import {ExpressionsHost} from '../src/host.ts';
import {createNativeTechneNavigator} from '../src/techne.ts';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge.ts';

const flag = process.argv.indexOf('--kernel-url');
if (flag < 0 || !process.argv[flag + 1]) throw Error('Pass the explicit running native bridge with --kernel-url');
const transport = {kind: 'bridge', url: process.argv[flag + 1]};
const expectedRef = 'expression:techne-m0.central.dd19f55a16862f362d32617854728b2a';
const inspect = async () => {
  const reply = await kernelOp(transport, {op: 'expression', request: {operation: 'inspect', expression_ref: expectedRef}});
  assert.equal(reply.error, undefined, reply.error);
  assert.equal(reply.outcome?.result, 'expression');
  assert.equal(reply.outcome.data.document?.expression_ref, expectedRef, 'The genuine retained Central composition must already exist');
  return reply.outcome.data.document;
};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const origin = 'http://127.0.0.1:8788';
const wire = messageWire(), messages = wire.messages;
const frame = new EventTarget();
frame.src = `${origin}/__application/expressions/index.html`;
frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
frame.closest = () => null;
let visible = true;
const host = new ExpressionsHost(frame, {bindingId: 'native-techne-acceptance', owners: {channels: {}},
  messageTarget: new EventTarget(), isPresented: () => visible});
const navigator = createNativeTechneNavigator({transport, host, isPresented: () => visible});
try {
  await wire.observe();
  assert.equal(messages.some(row => row.command === 'open-expression'), false);
  const stop = navigator.connectSelectionRequests();
  await wire.observe();
  assert.equal(messages.some(row => row.command === 'open-expression'), false, 'Mount does not automatically replace retained work');
  stop();
  const registers = await navigator.refreshRegisters();
  await wire.observe();
  assert.ok(registers.some(row => row.key === 'central'));
  assert.equal(messages.some(row => row.command === 'open-expression'), false, 'Refreshing the owner disclosure opens no work');
  await assert.rejects(navigator.openSelection({registerKey: 'central', sceneRef: '', entityRef: null}), /bounded native/);
  await assert.rejects(navigator.openRegister('__not_disclosed__'), /not disclosed/);
  visible = false;
  await assert.rejects(navigator.openRegister('central'), /concealed/);
  visible = true;
  const before = await inspect();
  await host.handleMessage({source: frame.contentWindow, origin, data: {v: 1, kind: 'oi-app-state', state: {
    hostMode: 'expressions', sceneCount: before.scenes.length,
    document: {id: before.expression_ref, name: before.title},
    nativeScene: {expression_ref: before.expression_ref, revision: before.revision, scene_ref: before.selection.scene_ref},
  }}});
  const opened = await navigator.openRegister('central', {lens: 'canvas'});
  assert.equal(opened.expression_ref, expectedRef);
  assert.equal(opened.revision, before.revision);
  assert.equal(opened.scene_ref, before.selection.scene_ref);
  await wire.observe();
  const opens = messages.filter(row => row.command === 'open-expression');
  assert.deepEqual(opens, [{v: 1, kind: 'host-command', command: 'open-expression', ref: expectedRef}]);
  assert.ok(messages.some(row => row.command === 'lens' && row.lens === 'canvas'));
  const after = await inspect();
  assert.equal(digest(after), digest(before), 'Opening existing native work preserves all authored state and revision');
  navigator.dispose();
  await assert.rejects(navigator.refreshRegisters(), /disposed/);
  console.log(JSON.stringify({grade: 'B', kernel_url: transport.url, passed: 8, faults: 0,
    claim: 'explicit native Technē register open, owner disclosure/refusals, retained revision and document equality; no automatic mount open',
    expression_ref: after.expression_ref, revision: after.revision, document_sha256: digest(after),
    ...(opened.drift ? {source_drift: opened.drift} : {})}));
} finally {navigator.dispose(); host.dispose(); wire.dispose();}
