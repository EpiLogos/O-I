// T-FRAME-TIME-PUSH, frame side: a shared-window nudge makes the Timeline/Places frame re-read the window through its own
// read (sharedTimeWindow.tsx), never from the nudge; the frame's own write is echoed without a re-render or a second write.
// The owner is the real native time-window owner over the real session store; only the kernel transport is stubbed.
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const engine = resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(resolve(engine, '../package.json'));
const {build} = require('esbuild');
const cradle = resolve(engine, '../../src/techne');
const boundary = resolve(engine, '../../../../packages/expressions-boundary/src');

let api;
let temporary;
let owner;
let context;
const requests = [];
let refusing = false;
let reading;
let store;
const BASIS = {expression_ref: 'expression:l5-dual-reading', revision: 1, scene_ref: 'scene:l5-dual-reading/ground'};
const parent = {};
const windowTarget = new EventTarget();
const WINDOW_FROM = '1850-01-01T00:00:00Z';
const WINDOW_TO = '1900-01-01T00:00:00Z';

test.before(async () => {
  temporary = await mkdtemp(join(tmpdir(), 'oi-shared-window-nudge-'));
  const transport = join(temporary, 'kernelExpressions-stub.mjs');
  await writeFile(transport, 'export const techneTimeWindowRequest = request => globalThis.__timeWindowOwner(request);\n');
  const pure = join(temporary, 'shared-window-nudge.mjs');
  await build({
    stdin: {
      contents: [
        `export * from ${JSON.stringify(resolve(engine, 'src/sharedTimeWindow.tsx'))};`,
        `export {createNativeTimeWindowOwner} from ${JSON.stringify(resolve(boundary, 'timeWindow.ts'))};`,
        `export {createDisclosureSessionStore} from ${JSON.stringify(resolve(cradle, 'session.ts'))};`,
        `export {groundSelection} from ${JSON.stringify(resolve(cradle, 'm0m5/reading.ts'))};`,
        `export {provingReading} from ${JSON.stringify(resolve(cradle, 'm0m5/journey/proving-reading.ts'))};`,
      ].join('\n'),
      resolveDir: engine,
      loader: 'ts',
    },
    bundle: true, format: 'esm', platform: 'node', outfile: pure, logLevel: 'silent',
    loader: {'.tsx': 'tsx', '.ts': 'ts', '.css': 'empty'}, jsx: 'automatic',
    plugins: [{
      name: 'kernel-transport-stub',
      setup(builder) {
        builder.onResolve({filter: /\/kernelExpressions\.js$/}, () => ({path: transport}));
      },
    }],
  });
  api = await import(`${pure}?t=${Date.now()}`);
  // The proving reading binds its Expression as `oi:expression:…`, which the host's basis refuses (`expression:` only);
  // the frame test admits the same reading under the host's exact basis, with its bindings withdrawn.
  reading = {...api.provingReading()};
  delete reading.expressions;
  store = api.createDisclosureSessionStore();
  store.setSelection(api.groundSelection(reading, 'timeline'), {expression_focus_ref: BASIS.expression_ref, scene_focus_ref: BASIS.scene_ref});
  owner = api.createNativeTimeWindowOwner({store});
  context = {mode: 'expressions', bindingId: 'center:world', epoch: 0, signal: new AbortController().signal,
    state: {nativeScene: {...BASIS}}, current: () => true};
  owner.admit({...BASIS}, reading, context);
  globalThis.__timeWindowOwner = request => {
    requests.push(structuredClone(request));
    if (refusing) return Promise.reject(Error('The native owner refused the read'));
    return Promise.resolve().then(() => owner.handle(request, context));
  };
  globalThis.window = Object.assign(windowTarget, {parent});
});

test.after(async () => {
  delete globalThis.window;
  delete globalThis.__timeWindowOwner;
  if (temporary) await rm(temporary, {recursive: true, force: true});
});

const count = operation => requests.filter(request => request.operation === operation).length;
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
function nudge(source = parent, data = {v: 1, kind: 'shared-time-nudge'}) {
  const event = new Event('message');
  event.source = source;
  event.data = data;
  windowTarget.dispatchEvent(event);
}
test('the nudge is read from the host only, and a message from anywhere else is ignored', async () => {
  const held = await api.readSharedTimeWindow({...BASIS}, reading, 'timeline', () => true);
  const refreshed = [];
  const stop = api.followSharedTimeNudges({basis: {...BASIS}, reading, instrument: 'timeline', current: () => true,
    held: () => held, refresh: reply => refreshed.push(reply)});
  const before = count('read');
  nudge({});
  nudge(parent, {v: 1, kind: 'something-else'});
  await settle();
  assert.equal(count('read'), before, 'nothing foreign or unnamed is read');
  assert.equal(refreshed.length, 0);
  stop();
});

test('a host window change re-reads through the existing read and moves the held window', async () => {
  let held = await api.readSharedTimeWindow({...BASIS}, reading, 'timeline', () => true);
  const refreshed = [];
  const stop = api.followSharedTimeNudges({basis: {...BASIS}, reading, instrument: 'timeline', current: () => true,
    held: () => held, refresh: reply => { held = reply; refreshed.push(reply); }});
  const reads = count('read');
  store.setTimeWindow({from: WINDOW_FROM, to: null}); // a change from elsewhere (the Earth, another instrument)
  nudge();
  await settle();
  assert.equal(count('read'), reads + 1, 'one re-read, through the existing read');
  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].session.time_window.from, WINDOW_FROM, 'the window is what the read returned, not what the nudge said');
  stop();
  store.setTimeWindow(null);
});

test("the frame's own write is echoed without a second write or a re-render, and the echo does not loop", async () => {
  let held = await api.readSharedTimeWindow({...BASIS}, reading, 'timeline', () => true);
  const refreshed = [];
  const stop = api.followSharedTimeNudges({basis: {...BASIS}, reading, instrument: 'timeline', current: () => true,
    held: () => held, refresh: reply => { held = reply; refreshed.push(reply); }});
  const sets = count('set');
  held = await api.writeSharedTimeWindow({...BASIS}, reading, 'timeline', held, {from: WINDOW_TO, to: null});
  assert.equal(count('set'), sets + 1);
  nudge(); // the echo of the frame's own write
  await settle();
  assert.equal(count('set'), sets + 1, 'the echo writes nothing');
  assert.equal(refreshed.length, 0, 'the echo of the held window does not re-render');
  nudge(); nudge();
  await settle();
  assert.equal(count('set'), sets + 1, 'repeated echoes do not loop into writes');
  assert.equal(refreshed.length, 0);
  stop();
  store.setTimeWindow(null);
});

test('a nudge that lands while the frame is writing waits for the write, then reconciles once', async () => {
  let held = await api.readSharedTimeWindow({...BASIS}, reading, 'timeline', () => true);
  const refreshed = [];
  const stop = api.followSharedTimeNudges({basis: {...BASIS}, reading, instrument: 'timeline', current: () => true,
    held: () => held, refresh: reply => { held = reply; refreshed.push(reply); }});
  const reads = count('read');
  const writing = api.writeSharedTimeWindow({...BASIS}, reading, 'timeline', held, {from: WINDOW_FROM, to: null});
  nudge(); // in flight: must not read yet
  assert.equal(count('read'), reads, 'no read while the frame\'s own write is in flight');
  held = await writing;
  await settle();
  assert.equal(count('read'), reads + 1, 'one reconciling read once the write settles');
  assert.equal(refreshed.length, 0, 'the reconciled window is the frame\'s own, so nothing re-renders');
  stop();
  store.setTimeWindow(null);
});

test('a lens that is no longer presented reads nothing, and a stopped follower hears nothing', async () => {
  const held = await api.readSharedTimeWindow({...BASIS}, reading, 'timeline', () => true);
  const refreshed = [];
  let presented = false;
  const stop = api.followSharedTimeNudges({basis: {...BASIS}, reading, instrument: 'timeline', current: () => presented,
    held: () => held, refresh: reply => refreshed.push(reply)});
  const reads = count('read');
  store.setTimeWindow({from: WINDOW_FROM, to: null});
  nudge();
  await settle();
  assert.equal(count('read'), reads, 'a concealed lens does not read on a nudge');
  stop();
  presented = true;
  nudge();
  await settle();
  assert.equal(count('read'), reads, 'a stopped follower hears nothing');
  assert.equal(refreshed.length, 0);
  store.setTimeWindow(null);
});

test('a refused re-read keeps the held window and raises nothing into the nudge', async () => {
  const held = await api.readSharedTimeWindow({...BASIS}, reading, 'timeline', () => true);
  const refreshed = [];
  const stop = api.followSharedTimeNudges({basis: {...BASIS}, reading, instrument: 'timeline', current: () => true,
    held: () => held, refresh: reply => refreshed.push(reply)});
  refusing = true;
  nudge();
  await settle();
  refusing = false;
  assert.equal(refreshed.length, 0, 'a refused read changes nothing');
  stop();
});

test('the Timeline and Places lenses follow the nudge through their own render paths; spatial writes are tracked; destroy tears the follower down', async () => {
  const {readFile} = await import('node:fs/promises');
  const source = await readFile(new URL('../src/researchInstruments.tsx', import.meta.url), 'utf8');
  assert.match(source, /if\(sharedTime\)followSharedTime\(\(\)=>render\(canvasNode2\(\)\)\);\s*render\(canvasNode2\(\)\);return;/, 'the Timeline follows, re-rendering through canvasNode2');
  assert.match(source, /if\(sharedTime\)followSharedTime\(\(\)=>render\(renderPlaces\(\)\)\);\s*render\(renderPlaces\(\)\);/, 'Places follows, re-rendering through renderPlaces');
  assert.match(source, /offSharedTimeNudges\?\.\(\);\s*offSharedTimeNudges=followSharedTimeNudges\(/, 'one follower at a time');
  assert.match(source, /destroy\(\)\{offSharedTimeNudges\?\.\(\);offSharedTimeNudges=null;/, 'destroy tears it down');
  assert.match(source, /return trackOwnSharedTimeWrite\(writeSharedSpatialFocusNow\(/, 'a spatial write is the frame’s own write');
  assert.match(source, /if\(draft&&!draft\.captured\)/, 'a draft the person is composing is never overwritten');
});
