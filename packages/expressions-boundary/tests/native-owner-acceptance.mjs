/** Native-owner protocol acceptance. The existing kernel bridge executes
 * real reads; no fixture kernel or fabricated success result. This proves
 * the portable request/response path, not an iframe/UI/save craft claim. */
import assert from 'node:assert/strict';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost} from '../src/index.ts';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge.ts';

const urlIndex = process.argv.indexOf('--kernel-url');
if (urlIndex < 0 || !process.argv[urlIndex + 1]) throw Error('Pass --kernel-url with the explicit running candidate native bridge');
const url = process.argv[urlIndex + 1], transport = {kind: 'bridge', url};
const origin = 'http://127.0.0.1:8788';
const wire = messageWire(), messages = wire.messages, source = {postMessage(data, expectedOrigin) {
  assert.equal(expectedOrigin, origin); wire.port1.postMessage(data);
}};
const frame = new EventTarget();
frame.src = `${origin}/__application/expressions/index.html`;
frame.contentWindow = source; frame.closest = () => null;
const nativeReplies = [];
const host = new ExpressionsHost(frame, {bindingId: 'native-acceptance', initialNavigationPending: true, messageTarget: new EventTarget(), owners: {
  channels: {'kernel-expression': async (request, context) => {
    const reply = await kernelOp(transport, {op: 'expression', request}, AbortSignal.any([context.signal, AbortSignal.timeout(10000)]));
    if (reply.error) {nativeReplies.push({error: reply.error}); throw Error(reply.error);}
    assert.equal(reply.outcome?.result, 'expression');
    nativeReplies.push(reply.outcome.data);
    return reply.outcome.data;
  }},
}});
try {
  // The real owner read starts during app boot, before initial iframe load.
  // This is the same production race; only later loads replace the epoch.
  const bootReading = host.handleMessage({source, origin, data: {v: 1, kind: 'kernel-expression', req: 1, request: {operation: 'list'}}});
  frame.dispatchEvent(new Event('load'));
  await bootReading;
  assert.equal(nativeReplies[0].schema, 'oi.expression-list/v1');
  assert.ok(Array.isArray(nativeReplies[0].expressions));
  const absentRef = `expression:boundary-absent:${crypto.randomUUID()}`;
  await host.handleMessage({source, origin, data: {v: 1, kind: 'kernel-expression', req: 2, request: {operation: 'inspect', expression_ref: absentRef}}});
  await wire.observe();
  const results = messages.filter(message => message.kind === 'kernel-expression-result');
  assert.equal(results.length, 2);
  assert.deepEqual(results[0].data, nativeReplies[0]);
  if (nativeReplies[1].error) {
    assert.equal(results[1].ok, false);
    assert.equal(results[1].error, nativeReplies[1].error);
  } else {assert.deepEqual(results[1].data, nativeReplies[1]); assert.equal(results[1].data.document, undefined);}
  console.log(JSON.stringify({grade: 'B', kernel_url: url, claim: 'portable host preserves real boot owner read across initial load and routes native missing-subject inspection without rewriting results',
    expression_count: nativeReplies[0].expressions.length, passed: 2, faults: 0}));
} finally {host.dispose(); wire.dispose();}
