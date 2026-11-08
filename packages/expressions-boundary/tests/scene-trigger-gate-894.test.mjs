// O-I #747 round 894 (DLW build ruling 2026-11-07; manual §20.1 Triggers, Target "Run a native Action"): the frame asks the owner's
// `trigger` for a scene trigger's native Action, which the owner runs only as a reading. The press that runs a writing Action is the
// person's, in the shell: the frame's gate admits the trigger and refuses a press it sends, by name, before any owner is asked.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, CHANNEL_VERSION} from '../src/index.ts';
import {readFrameTriggerRequest} from '../src/protocol.ts';

const origin = 'http://127.0.0.1:8788';
const EXPRESSION = 'expression:palace-probe';
const readyState = {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1, document: {id: EXPRESSION, name: 'Probe'},
  nativeScene: {expression_ref: EXPRESSION, revision: 3, scene_ref: 'scene:one'}};
const frameAction = (overrides = {}) => ({operation: 'invoke_action',
  route: {action_ref: 'aikit.wiki.stage', subject_ref: 'wiki:node:probe', selection_ref: null, input: {summary: 'probe', basis_ref: 'reading:one'}},
  reading_ref: 'reading:one',
  reading_request: {expression_ref: EXPRESSION, revision: 3, scene_ref: 'scene:one', scope: 'expression'},
  actor: 'human:techne-palace', ...overrides});

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

const trigger = (overrides = {}) => ({operation: 'trigger', expression_ref: EXPRESSION, scene_ref: 'scene:one', trigger_ref: `${EXPRESSION}:trigger:t`, ...overrides});

test('a scene trigger the frame sends reaches the kernel-expression owner exactly, with no press', async t => {
  const seen = [];
  const a = aperture(t, {channels: {'kernel-expression': async request => {seen.push(request); return {state: 'withheld', action_ref: 'central.pages.stamp'};}}});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: readyState});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 21, request: trigger()});
  assert.deepEqual(seen, [trigger()]);
  const reply = (await a.messages()).find(d => d.kind === 'kernel-expression-result' && d.req === 21);
  assert.equal(reply.ok, true);
  assert.equal(reply.data.state, 'withheld');
});

test('a press the frame sends is refused by name: the press is the person\'s, in the shell; a malformed trigger never reaches the owner', async t => {
  let calls = 0;
  const a = aperture(t, {channels: {'kernel-expression': async () => {calls++; return {};}}});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 22, request: trigger({press: true})});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 23, request: trigger({trigger_ref: ''})});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 24, request: trigger({expression_ref: 'not-an-expression'})});
  assert.equal(calls, 0);
  const replies = (await a.messages()).filter(d => d.kind === 'kernel-expression-result');
  assert.match(replies.find(r => r.req === 22).error, /A trigger's press is the person's/);
  for (const req of [23, 24]) assert.match(replies.find(r => r.req === req).error, /Malformed trigger request/);
});

test('the trigger request parses only its exact shape', () => {
  assert.deepEqual(readFrameTriggerRequest(trigger()), trigger());
  assert.deepEqual(readFrameTriggerRequest(trigger({press: false})), trigger());
  assert.equal(readFrameTriggerRequest(trigger({press: true})), null);
  assert.equal(readFrameTriggerRequest(trigger({extra: 1})), null);
  assert.equal(readFrameTriggerRequest(trigger({scene_ref: 7})), null);
});
