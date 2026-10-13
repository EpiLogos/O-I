// T-FRAME-TIME-PUSH: when the session's shared time window changes, each presented Expressions frame is nudged (value-free),
// and the nudge is never a carrier. Covers the narrow window-change subscription (techne/session.ts), the new-shell host
// (packages/expressions-boundary ExpressionsHost) and the cradle host (PointCloudHost, source-level: it is a React component).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createDisclosureSessionStore, onSharedTimeWindowChange, SHARED_TIME_NUDGE} from '../src/techne/session.ts';
import {groundSelection} from '../src/techne/m0m5/reading.ts';
import {provingReading} from '../src/techne/m0m5/journey/proving-reading.ts';
// The boundary's own production-source loader (TypeScript transpile, type-only imports elided): the host imports app modules
// whose type-only imports plain strip-types cannot load. Registered before the dynamic import below.
import {register} from 'node:module';
register('../../../packages/expressions-boundary/tests/editor-source-loader.mjs', import.meta.url);
const {ExpressionsHost} = await import('../../../packages/expressions-boundary/src/host.ts');
const {CHANNEL_VERSION} = await import('../../../packages/expressions-boundary/src/protocol.ts');

const EXPRESSION = 'expression:l5-dual-reading';
const SCENE = 'scene:l5-dual-reading/ground';

const ORIGIN = 'http://127.0.0.1:8788';
const WINDOW = {from: '1850-01-01T00:00:00Z', to: null};
const READY_STATE = {
  hostMode: 'expressions', sceneIndex: 0, sceneCount: 1,
  document: {id: EXPRESSION, name: 'Proving work'},
  nativeScene: {expression_ref: EXPRESSION, revision: 1, scene_ref: SCENE},
  selection: [{id: 'entity:one', name: 'A real selection reading'}],
};

/** A session standing on the proving reading, as the shared store holds it once a reading is admitted. */
function storeWithSession() {
  const store = createDisclosureSessionStore();
  store.setSelection(groundSelection(provingReading(), 'timeline'), {expression_focus_ref: EXPRESSION, scene_focus_ref: SCENE});
  return store;
}

function mount(t, store, options = {}) {
  const frame = new EventTarget();
  frame.src = `${ORIGIN}/__application/expressions/index.html`;
  const sent = [];
  frame.contentWindow = {postMessage(data, targetOrigin) { assert.equal(targetOrigin, ORIGIN); sent.push(structuredClone(data)); }};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {
    bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000,
    ...(store ? {sharedWindow: store} : {}), ...options,
  });
  t.after(() => host.dispose());
  const ready = () => host.handleMessage({source: frame.contentWindow, origin: ORIGIN, data: {v: CHANNEL_VERSION, kind: 'oi-app-state', state: READY_STATE}});
  const nudges = () => sent.filter(message => message.kind === SHARED_TIME_NUDGE);
  return {host, ready, nudges};
}

test('the nudge is one named, value-free message', () => {
  assert.equal(SHARED_TIME_NUDGE, 'shared-time-nudge');
});

test('the window-change subscription fires once per window change, never for a selection-only change or a cleared session', () => {
  const store = storeWithSession();
  let fired = 0;
  const stop = onSharedTimeWindowChange(store, () => fired++);
  store.setTimeWindow(WINDOW);
  assert.equal(fired, 1);
  store.setTimeWindow({...WINDOW});
  assert.equal(fired, 1, 'the same window is not a change');
  store.setSelection(groundSelection(provingReading(), 'timeline'), {expression_focus_ref: EXPRESSION, scene_focus_ref: SCENE});
  assert.equal(fired, 1, 'a selection-only change is not a window change');
  store.setTimeWindow(null);
  assert.equal(fired, 2);
  store.setTimeWindow(WINDOW);
  assert.equal(fired, 3);
  store.clear();
  assert.equal(fired, 3, 'no session stands, so nothing runs');
  stop();
  store.setSelection(groundSelection(provingReading(), 'timeline'));
  store.setTimeWindow(WINDOW);
  assert.equal(fired, 3, 'a stopped subscription is released');
});

test('a ready, presented frame gets exactly one value-free nudge per window change', async t => {
  const store = storeWithSession();
  const {ready, nudges} = mount(t, store);
  await ready();
  store.setTimeWindow(WINDOW);
  assert.deepEqual(nudges(), [{v: CHANNEL_VERSION, kind: SHARED_TIME_NUDGE}]);
  assert.equal(Object.keys(nudges()[0]).includes('from'), false);
  assert.equal(JSON.stringify(nudges()).includes('1850'), false, 'the nudge never carries the window');
  store.setTimeWindow({...WINDOW});
  assert.equal(nudges().length, 1, 'an unchanged window is not nudged again');
});

test('an unready or concealed frame, or a host without a shared window, is not nudged', async t => {
  const store = storeWithSession();
  const unready = mount(t, store);
  store.setTimeWindow(WINDOW);
  assert.equal(unready.nudges().length, 0, 'a frame that has not answered its state handshake is not nudged');

  let presented = false;
  const concealed = mount(t, store, {isPresented: () => presented});
  await concealed.ready();
  store.setTimeWindow(null);
  assert.equal(concealed.nudges().length, 0, 'a concealed frame re-reads on presentation, so it is not nudged');

  const unbound = mount(t, undefined);
  await unbound.ready();
  store.setTimeWindow(WINDOW);
  assert.equal(unbound.nudges().length, 0, 'a host bound to no shared window never nudges');
});

test('the legacy cradle host does not nudge: its relay serves no shared window, so the new shell host is the only one that does', async () => {
  // The cradle relay (src/expressions/hostedApp.ts) has no techne-time-window handler, so a frame under PointCloudHost cannot
  // read the shared window; a nudge there would be a message with no read behind it.
  const source = await readFile(fileURLToPath(new URL('../src/expressions/PointCloudHost.tsx', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /SHARED_TIME_NUDGE|onSharedTimeWindowChange/);
});
