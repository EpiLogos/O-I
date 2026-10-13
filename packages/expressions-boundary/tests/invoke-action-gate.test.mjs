// lane-5 T19 Accept: the frame's routed Return reaches the native owner through the EXISTING kernel-expression gate.
// The gate admits only the well-formed frame action; the owner (not this gate) decides whether the action is still offered
// by the reading, and nothing here manufactures authority or asserts a grant.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, CHANNEL_VERSION} from '../src/index.ts';
import {readFrameActionRequest, decideFrameAction} from '../src/protocol.ts';

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

test('an invoke_action the frame sends is admitted to the kernel-expression owner and its answer returns as the reply', async t => {
  const seen = [];
  const a = aperture(t, {channels: {'kernel-expression': async (request) => {seen.push(request); return {state: 'dispatched', dispatch: {state: 'invoked', owner_operation: 'aikit.wiki.stage', data: {}}};}}});
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: readyState});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 7, request: frameAction()});
  assert.equal(seen.length, 1, 'the owner is reached through the existing gate');
  assert.equal(seen[0].operation, 'invoke_action');
  const reply = (await a.messages()).find(d => d.kind === 'kernel-expression-result' && d.req === 7);
  assert.equal(reply.ok, true);
  assert.equal(reply.data.dispatch.state, 'invoked');
});

test('a malformed invoke_action never reaches the owner and is refused by name', async t => {
  let calls = 0;
  const a = aperture(t, {channels: {'kernel-expression': async () => {calls++; return {};}}});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 8, request: {...frameAction(), route: {subject_ref: 'wiki:node:probe'}}});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 9, request: {...frameAction(), actor: ''}});
  assert.equal(calls, 0);
  const replies = (await a.messages()).filter(d => d.kind === 'kernel-expression-result');
  assert.equal(replies.length, 2);
  for (const reply of replies) {assert.equal(reply.ok, false); assert.match(reply.error, /Malformed invoke_action/);}
});

test('operations outside the frame list are still refused by name, invoke_action or not', async t => {
  let calls = 0;
  const a = aperture(t, {channels: {'kernel-expression': async () => {calls++; return {};}}});
  await a.deliver({v: 1, kind: 'kernel-expression', req: 10, request: {...frameAction(), operation: 'execute_ambient_command'}});
  assert.equal(calls, 0);
  const reply = (await a.messages()).find(d => d.kind === 'kernel-expression-result' && d.req === 10);
  assert.match(reply.error, /Unsupported kernel-expression operation/);
});

test('the frame action parses only its exact shape and keeps the source reading and actor', () => {
  const parsed = readFrameActionRequest(frameAction());
  assert.equal(parsed.route.action_ref, 'aikit.wiki.stage');
  assert.equal(parsed.reading_ref, 'reading:one');
  assert.equal(parsed.actor, 'human:techne-palace');
  assert.equal(readFrameActionRequest(frameAction({reading_request: {expression_ref: 'not-an-expression', revision: 3, scene_ref: 'scene:one'}})), null);
  assert.equal(readFrameActionRequest(frameAction({reading_request: {expression_ref: EXPRESSION, revision: 0, scene_ref: 'scene:one'}})), null);
  assert.equal(readFrameActionRequest(frameAction({route: {action_ref: 'aikit.wiki.stage', subject_ref: 'wiki:node:probe', input: 'text'}})), null);
});

// The reading is the owner's; the stub carries the only fields the routing law reads (its ref, subject and disclosed actions).
const reading = (actions = [{action_ref: 'aikit.wiki.stage', native_owner: 'aikit', authority: 'governed-write', expected_effects: ['wiki staged']}]) => ({
  reading_ref: 'reading:one', subject: {subject_ref: 'wiki:node:probe'}, actions});

test('the owner decides an offered action under its reading: attributed, with no grant asserted', () => {
  const verdict = decideFrameAction(reading(), readFrameActionRequest(frameAction()));
  assert.equal(verdict.ok, true);
  assert.equal(verdict.action, 'aikit.wiki.stage');
  assert.equal(verdict.target_ref, 'wiki:node:probe');
  assert.equal(verdict.input.actor, 'human:techne-palace', 'the actor travels with the action');
  assert.equal(verdict.input.source_reading_ref, 'reading:one', 'the source reading travels with the action');
  assert.equal('authority' in verdict, false, 'the frame never asserts an authority grant');
});

test('an action the reading does not offer is refused by name, never invoked', () => {
  const verdict = decideFrameAction(reading([]), readFrameActionRequest(frameAction()));
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /not disclosed by reading reading:one/);
});

test('a proposal made from an earlier reading is refused as stale', () => {
  const verdict = decideFrameAction({...reading(), reading_ref: 'reading:two'}, readFrameActionRequest(frameAction()));
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /stale/);
});

test('a route that names another subject is refused by the routing law', () => {
  const verdict = decideFrameAction(reading(), readFrameActionRequest(frameAction({route: {action_ref: 'aikit.wiki.stage', subject_ref: 'wiki:node:other'}})));
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /one subject, one route/);
});
