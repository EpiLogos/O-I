// O-I #747 round 895 (DLW build ruling 2026-11-08): the frame asks only its presented work's triggers, as readings. A trigger request that
// names another open work is refused by name before any owner is asked. Deleting a work closes it here too: an open of it held until the
// application is ready is dropped and answered, never refired, and the application is told to let go of it with the words of what was
// deleted (the frame's close-expression).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, CHANNEL_VERSION} from '../src/index.ts';
import {readFrameTriggerRequest} from '../src/protocol.ts';

const origin = 'http://127.0.0.1:8788';
const PRESENTED = 'expression:presented-895', OTHER = 'expression:other-open-895';
const readyState = {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1, document: {id: PRESENTED, name: 'Presented'},
  nativeScene: {expression_ref: PRESENTED, revision: 3, scene_ref: 'scene:one'}};
const trigger = (expression_ref = PRESENTED) => ({operation: 'trigger', expression_ref, scene_ref: 'scene:one', trigger_ref: `${expression_ref}:trigger:t`});

function aperture(t, owners) {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  return {host, deliver, messages: wire.observe};
}

test('a trigger request is read only for the presented work', () => {
  assert.deepEqual(readFrameTriggerRequest(trigger(), PRESENTED), trigger());
  assert.equal(readFrameTriggerRequest(trigger(OTHER), PRESENTED), null, 'another open work\'s trigger');
  assert.equal(readFrameTriggerRequest(trigger(), undefined), null, 'no work presented');
});

test('the frame\'s trigger for another open work never reaches the owner, and is refused by name', async t => {
  const seen = [];
  const a = aperture(t, {channels: {'kernel-expression': async request => {seen.push(request); return {state: 'action_result'};}}});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: readyState});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 31, request: trigger(OTHER)});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 32, request: trigger()});
  assert.deepEqual(seen, [trigger()], 'only the presented work\'s trigger is asked');
  const replies = (await a.messages()).filter(d => d.kind === 'kernel-expression-result');
  assert.match(replies.find(r => r.req === 31).error, /presented work alone/);
  assert.equal(replies.find(r => r.req === 32).ok, true);
});

test('a deleted work\'s held open is dropped and answered, and the application is told to let go of it', async t => {
  const a = aperture(t, {channels: {}});
  const held = a.host.openExpression(PRESENTED, 'center:world');
  a.host.closeDeleted(PRESENTED, 'Presented left the works home for Central\'s trash.');
  assert.deepEqual(await held, {ok: false, error: 'Presented left the works home for Central\'s trash.'});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: readyState});
  const sent = await a.messages();
  assert.ok(!sent.some(d => d.kind === 'host-command' && d.command === 'open-expression'), 'the dropped open is never refired on readiness');
  assert.deepEqual(sent.find(d => d.kind === 'host-command' && d.command === 'close-expression'),
    {v: CHANNEL_VERSION, kind: 'host-command', command: 'close-expression', ref: PRESENTED, words: 'Presented left the works home for Central\'s trash.'});
});
