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

test('a kept Torus sound is saved and opened under the frame\'s own lease, and under no other (O-I #852)', async t => {
  const operations = [];
  const a = aperture(t, {channels: {}, native: async request => {
    operations.push(request);
    if (request.operation === 'open') return {schema: 'oi.native-expression-open/v1', lease: 'lease:one'};
    if (request.operation === 'torus_sound') return {schema: 'oi.torus-sound/v1', name: request.name};
    return {schema: 'oi.torus-sound-opening/v1', moved: []};
  }});
  const epoch = (await a.messages()).find(d => d.schema === NATIVE_CHANNEL && d.kind === 'available').epoch;
  const native = (req, request) => a.deliver({schema: NATIVE_CHANNEL, epoch, kind: 'request', req, request});
  await native(1, {operation: 'open', path: 'Control/work.json'});
  await native(2, {operation: 'torus_sound', lease: 'lease:one', checkpoint_sha256: 'sha256:kept', name: 'Low bell'});
  await native(3, {operation: 'torus_sound_open', lease: 'lease:one', sound: {schema: 'oi.torus-sound/v1'}, now_sha256: 'sha256:now'});
  await native(4, {operation: 'torus_sound', lease: 'lease:foreign', checkpoint_sha256: 'sha256:kept', name: 'Low bell'});
  assert.deepEqual(operations.map(r => r.operation), ['open', 'torus_sound', 'torus_sound_open']);
  const results = (await a.messages()).filter(d => d.schema === NATIVE_CHANNEL && d.kind === 'result');
  assert.deepEqual(results.find(d => d.req === 2), {schema: NATIVE_CHANNEL, epoch, kind: 'result', req: 2, ok: true, data: {schema: 'oi.torus-sound/v1', name: 'Low bell'}});
  assert.equal(results.find(d => d.req === 3).data.schema, 'oi.torus-sound-opening/v1');
  assert.match(results.find(d => d.req === 4).error, /lease does not belong/);
});

test('a Torus take is sealed under the frame\'s own lease, by its checkpoint\'s name or the checkpoint itself, and under no other (O-I #855)', async t => {
  const operations = [];
  const a = aperture(t, {channels: {}, native: async request => {
    operations.push(request);
    if (request.operation === 'open') return {schema: 'oi.native-expression-open/v1', lease: 'lease:one'};
    return {schema: 'oi.torus-take/v1', take_ref: 'sha256:take'};
  }});
  const epoch = (await a.messages()).find(d => d.schema === NATIVE_CHANNEL && d.kind === 'available').epoch;
  const native = (req, request) => a.deliver({schema: NATIVE_CHANNEL, epoch, kind: 'request', req, request});
  const checkpoint = {schema: 'ql.torus-checkpoint/v1', taken_at_samples: '9600', sample_rate: 48000};
  await native(1, {operation: 'open', path: 'Control/work.json'});
  await native(2, {operation: 'torus_take', lease: 'lease:one', checkpoint_sha256: 'sha256:kept'});
  await native(3, {operation: 'torus_take', lease: 'lease:one', checkpoint});
  await native(4, {operation: 'torus_take', lease: 'lease:foreign', checkpoint});
  assert.deepEqual(operations.map(r => r.operation), ['open', 'torus_take', 'torus_take']);
  assert.deepEqual(operations[2], {operation: 'torus_take', lease: 'lease:one', checkpoint}, 'the checkpoint goes to the kernel whole');
  const results = (await a.messages()).filter(d => d.schema === NATIVE_CHANNEL && d.kind === 'result');
  assert.deepEqual(results.find(d => d.req === 2).data, {schema: 'oi.torus-take/v1', take_ref: 'sha256:take'});
  assert.equal(results.find(d => d.req === 3).ok, true);
  assert.match(results.find(d => d.req === 4).error, /lease does not belong/);
});

test('the cradle\'s own relay seals a Torus take under the frame\'s lease as the host does, and under no other (O-I #855)', async t => {
  const {relayNativeChannel} = await import('../../../desktop/cradle/src/expressions/nativeChannel.ts');
  const saved = {window: globalThis.window, IntersectionObserver: globalThis.IntersectionObserver};
  const posted = [], calls = [];
  globalThis.window = new EventTarget();
  globalThis.IntersectionObserver = class {observe() {} disconnect() {}};
  const frame = new EventTarget();
  frame.contentWindow = {postMessage: data => posted.push(data)};
  const dispose = relayNativeChannel(frame, {kind: 'bridge', url: 'http://127.0.0.1:1'}, async request => {
    calls.push(request);
    return request.operation === 'open' ? {schema: 'oi.native-expression-open/v1', lease: 'lease:one'} : {schema: 'oi.torus-take/v1'};
  });
  t.after(() => {dispose(); globalThis.window = saved.window; globalThis.IntersectionObserver = saved.IntersectionObserver;});
  const epoch = posted.find(d => d.kind === 'available').epoch;
  const send = async (req, request) => {
    const event = Object.assign(new Event('message'), {source: frame.contentWindow, data: {schema: NATIVE_CHANNEL, epoch, kind: 'request', req, request}});
    globalThis.window.dispatchEvent(event);
    for (let i = 0; i < 20 && !posted.some(d => d.kind === 'result' && d.req === req); i++) await new Promise(resolve => setTimeout(resolve, 1));
    return posted.find(d => d.kind === 'result' && d.req === req);
  };
  assert.equal((await send(1, {operation: 'open', path: 'Control/work.json', expected_revision: 'r'})).ok, true);
  const checkpoint = {schema: 'ql.torus-checkpoint/v1', taken_at_samples: '9600', sample_rate: 48000};
  assert.deepEqual((await send(2, {operation: 'torus_take', lease: 'lease:one', checkpoint})).data, {schema: 'oi.torus-take/v1'});
  assert.match((await send(3, {operation: 'torus_take', lease: 'lease:foreign', checkpoint})).error, /lease does not belong/);
  assert.deepEqual(calls.map(r => r.operation), ['open', 'torus_take']);
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

test('a browser draft opens by its Library id on the open-local-draft command, for the presented target only, and waits for readiness', async t => {
  const a = aperture(t);
  assert.throws(() => a.host.openLocalDraft('draft-1', 'center:other'), /presented target/);
  assert.throws(() => a.host.openLocalDraft('', 'center:world'), /draft id is required/);
  a.host.openLocalDraft('draft-1', 'center:world');
  a.host.openLocalDraft('draft-2', 'center:world');
  assert.equal((await a.messages()).filter(d => d.command === 'open-local-draft').length, 0, 'nothing is posted before the frame is ready');
  await a.deliver({v: 1, kind: 'oi-app-state', state: state()});
  assert.deepEqual((await a.messages()).filter(d => d.command === 'open-local-draft' || d.command === 'open-expression'),
    [{v: CHANNEL_VERSION, kind: 'host-command', command: 'open-local-draft', id: 'draft-2'}], 'last wins; the draft rides the host-command channel');
  a.host.openLocalDraft('draft-3', 'center:world');
  assert.equal((await a.messages()).filter(d => d.command === 'open-local-draft' && d.id === 'draft-3').length, 1);
});
