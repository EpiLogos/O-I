import assert from 'node:assert/strict';
import {test} from 'node:test';
import {messageWire} from './message-wire.mjs';
import {ExpressionsHost, readHostedState, resolveActionRoute, CHANNEL_VERSION, NATIVE_CHANNEL} from '../src/index.ts';

const origin = 'http://127.0.0.1:8788';
const state = (revision = 3) => ({hostMode: 'expressions', sceneIndex: 0, sceneCount: 1,
  document: {id: 'expression:kept', name: 'Kept work'}, nativeScene: {expression_ref: 'expression:kept', revision, scene_ref: 'scene:one'},
  selection: [{id: 'entity:one', name: 'A real selection reading'}]});

/** Transport-level acceptance, not a DOM/kernel claim: real MessageChannel
 * carries controller output. The frame's DOM lifetime is represented by an
 * EventTarget; native application acceptance belongs to the shell UI walk. */
function aperture(t, owners = {channels: {}}, extra = {}) {
  const wire = messageWire();
  const frame = new EventTarget();
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); wire.port1.postMessage(data);}};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000, ...extra});
  t.after(() => {host.dispose(); wire.dispose();});
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
  const messages = wire.observe;
  return {frame, host, deliver, messages};
}

test('readiness requires the actual application state and rejects malformed or contradictory identities', async t => {
  const statuses = [], a = aperture(t, undefined, {onStatus: value => statuses.push(value)});
  for (const value of [{}, [], {hostMode: 'techne'}, {...state(), nativeScene: {...state().nativeScene, revision: NaN}},
    {...state(), document: {id: 'expression:foreign'}}, {...state(), selection: [{id: 4}]}]) {
    assert.equal(readHostedState(value), null);
    await a.deliver({v: 1, kind: 'oi-app-state', state: value});
    assert.equal(a.host.isReady(), false);
  }
  await a.deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: state()});
  assert.equal(a.host.isReady(), true);
  assert.deepEqual(statuses, ['loading', 'ready']);
  assert.equal(a.host.getState().nativeScene.expression_ref, 'expression:kept');
});

test('foreign frame, wrong origin, bad version and malformed request cannot reach an owner', async t => {
  let calls = 0;
  const a = aperture(t, {channels: {'kernel-expression': async () => {calls++; throw Error('Native owner refused');}}});
  const request = {v: 1, kind: 'kernel-expression', req: 1, request: {operation: 'inspect', expression_ref: 'expression:kept'}};
  await a.host.handleMessage({source: {}, origin, data: request});
  await a.host.handleMessage({source: a.frame.contentWindow, origin: 'https://foreign.example', data: request});
  await a.deliver({...request, v: 2});
  await a.deliver({...request, req: 0});
  await a.deliver({...request, req: 2, request: {operation: 'execute_ambient_command'}});
  assert.equal(calls, 0);
  await a.deliver(request);
  assert.equal(calls, 1);
  const reply = (await a.messages()).find(d => d.kind === 'kernel-expression-result' && d.req === 1);
  assert.deepEqual(reply, {v: 1, kind: 'kernel-expression-result', req: 1, ok: false, error: 'Native owner refused'});
});

test('a duplicate request is refused and an unknown owner produces a correlated refusal', async t => {
  let calls = 0;
  const a = aperture(t, {channels: {'kernel-expression': async () => {calls++; return {state: 'absent'};}}});
  const request = {v: 1, kind: 'kernel-expression', req: 1, request: {operation: 'inspect', expression_ref: 'expression:missing'}};
  await a.deliver(request); await a.deliver(request);
  await a.deliver({v: 1, kind: 'invented-owner', req: 2, request: {}});
  assert.equal(calls, 1);
  const messages = await a.messages();
  assert.equal(messages.filter(d => d.req === 1 && d.ok === false).length, 1);
  assert.match(messages.find(d => d.req === 2).error, /No native owner/);
});

test('reload aborts the request and a late owner answer cannot enter the replacement epoch', async t => {
  let finish, signal;
  const a = aperture(t, {channels: {'kernel-expression': (_request, context) => {
    signal = context.signal; return new Promise(resolve => {finish = resolve;});
  }}});
  const pending = a.deliver({v: 1, kind: 'kernel-expression', req: 1, request: {operation: 'list'}});
  a.frame.dispatchEvent(new Event('load'));
  assert.equal(signal.aborted, true);
  finish({expressions: []}); await pending;
  assert.equal((await a.messages()).some(d => d.kind === 'kernel-expression-result'), false);
  assert.equal(a.host.isReady(), false);
});

test('initial document load retains boot requests and the pending native open; a later reload aborts them', async t => {
  let finish, signal;
  const a = aperture(t, {channels: {'kernel-expression': (_request, context) => {
    signal = context.signal; return new Promise(resolve => {finish = resolve;});
  }}}, {initialNavigationPending: true});
  a.host.openExpression('expression:retained-open', 'center:world');
  await a.deliver({v: 1, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1}});
  const pending = a.deliver({v: 1, kind: 'kernel-expression', req: 1, request: {operation: 'inspect', expression_ref: 'expression:retained-open'}});
  a.frame.dispatchEvent(new Event('load'));
  assert.equal(signal.aborted, false);
  assert.equal(a.host.isReady(), true);
  const ownerReading = {state: 'absent', expression_ref: 'expression:retained-open'};
  finish(ownerReading); await pending;
  const messages = await a.messages();
  assert.deepEqual(messages.find(row => row.kind === 'kernel-expression-result').data, ownerReading);
  assert.equal(messages.filter(row => row.command === 'open-expression' && row.ref === 'expression:retained-open').length, 1);
  const replacement = a.deliver({v: 1, kind: 'kernel-expression', req: 2, request: {operation: 'list'}});
  a.frame.dispatchEvent(new Event('load'));
  assert.equal(signal.aborted, true);
  finish({expressions: []}); await replacement;
  assert.equal((await a.messages()).some(row => row.kind === 'kernel-expression-result' && row.req === 2), false);
  assert.equal(a.host.isReady(), false);
});

test('mode changes retain frame URL, document and selection; opens name their presented host', async t => {
  let visible = true;
  const a = aperture(t, undefined, {isPresented: () => visible});
  const initialURL = a.frame.src;
  await a.deliver({v: 1, kind: 'oi-app-state', state: state()});
  const selected = a.host.getState();
  a.host.setMode('techne'); a.host.setMode('expressions');
  assert.equal(a.frame.src, initialURL);
  assert.deepEqual(a.host.getState(), selected);
  assert.throws(() => a.host.openExpression('expression:next', 'center:other'), /presented target/);
  visible = false;
  assert.throws(() => a.host.openExpression('expression:next', 'center:world'), /presented target/);
  visible = true;
  a.host.openExpression('expression:next', 'center:world', {lens: 'canvas'});
  assert.equal((await a.messages()).filter(d => d.command === 'open-expression' && d.ref === 'expression:next').length, 1);
});

test('pre-handshake opens converge on one latest ref and stale scene captures are refused', async t => {
  const a = aperture(t);
  a.host.openExpression('expression:one', 'center:world');
  a.host.openExpression('expression:two', 'center:world');
  await a.deliver({v: 1, kind: 'oi-app-state', state: state()});
  let opens = (await a.messages()).filter(d => d.command === 'open-expression');
  assert.deepEqual(opens.map(d => d.ref), ['expression:two']);
  const capture = a.host.captureTarget();
  a.host.assertTarget(capture);
  await a.deliver({v: 1, kind: 'oi-app-state', state: state(4)});
  assert.throws(() => a.host.assertTarget(capture), /captured native Scene changed/);
  const replacement = a.host.captureTarget();
  a.frame.dispatchEvent(new Event('load'));
  await a.deliver({v: 1, kind: 'oi-app-state', state: state(4)});
  assert.throws(() => a.host.assertTarget(replacement), /captured native Scene changed/);
  opens = (await a.messages()).filter(d => d.command === 'open-expression');
  assert.equal(opens.length, 1);
});

test('private recovery traffic without an owner-selected address is refused before reaching an owner', async t => {
  let received;
  const a = aperture(t, {channels: {'expression-recovery': async request => {received = request;}}}, {mode: 'techne'});
  await a.deliver({v: 1, kind: 'expression-recovery', req: 1, request: {operation: 'read', scope: 'expressions', kind: 'draft', id: 'private'}});
  assert.equal(received, undefined);
  const refusal = (await a.messages()).find(d => d.kind === 'expression-recovery-result');
  assert.equal(refusal.ok, false);
  assert.match(refusal.error, /No host-selected native recovery address/);
});

test('native driver lease is frame-epoch owned, exclusive and released on dispose', async t => {
  const operations = [];
  const a = aperture(t, {channels: {}, native: async request => {
    operations.push(request);
    if (request.operation === 'open') return {schema: 'oi.native-expression-open/v1', lease: 'lease:one'};
    return {state: 'closed'};
  }});
  const epoch = (await a.messages()).find(d => d.schema === NATIVE_CHANNEL && d.kind === 'available').epoch;
  const native = (req, request) => a.deliver({schema: NATIVE_CHANNEL, epoch, kind: 'request', req, request});
  await native(1, {operation: 'open', path: 'Control/work.json'});
  await native(2, {operation: 'open', path: 'Control/work.json'});
  await native(3, {operation: 'exchange', lease: 'lease:foreign'});
  assert.deepEqual(operations.map(r => r.operation), ['open']);
  const failures = (await a.messages()).filter(d => d.schema === NATIVE_CHANNEL && d.kind === 'result' && d.ok === false);
  assert.equal(failures.length, 2);
  a.host.dispose();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(operations.at(-1), {operation: 'close', lease: 'lease:one'});
});

test('a native lease that opens after reload is closed and never adopted by the new frame', async t => {
  let finish;
  const closed = [];
  const a = aperture(t, {channels: {}, native: request => {
    if (request.operation === 'close') {closed.push(request.lease); return Promise.resolve({state: 'closed'});}
    return new Promise(resolve => {finish = resolve;});
  }});
  const epoch = (await a.messages()).find(d => d.schema === NATIVE_CHANNEL).epoch;
  const pending = a.deliver({schema: NATIVE_CHANNEL, epoch, kind: 'request', req: 1, request: {operation: 'open'}});
  a.frame.dispatchEvent(new Event('load'));
  finish({schema: 'oi.native-expression-open/v1', lease: 'lease:late'});
  await pending;
  assert.deepEqual(closed, ['lease:late']);
  assert.equal((await a.messages()).some(d => d.schema === NATIVE_CHANNEL && d.kind === 'result'), false);
});

test('canonical Action routing preserves opaque subject and owner authority and never executes', () => {
  const reading = {reading_ref: 'reading:one', subject: {subject_ref: 'ql:opaque/one'}, actions: [
    {action_ref: 'action:edit', native_owner: 'ql', authority: 'owner:ql', expected_effects: ['revision-advance']},
  ]};
  const route = {action_ref: 'action:edit', subject_ref: 'ql:opaque/one'};
  assert.deepEqual(resolveActionRoute(reading, route), {action_ref: 'action:edit', native_owner: 'ql', routed: true, authority: 'owner:ql', expected_effects: ['revision-advance']});
  assert.equal(resolveActionRoute(reading, {...route, subject_ref: 'ql:other'}).routed, false);
  assert.equal(resolveActionRoute(reading, {...route, action_ref: 'action:undisclosed'}).routed, false);
  assert.throws(() => resolveActionRoute(reading, {...route, executable: '/bin/sh'}), /malformed/);
});
