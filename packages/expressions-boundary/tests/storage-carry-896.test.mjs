// O-I #747 round 896, 1R-surface.1 and .2 (DLW build ruling 2026-11-09): the Expressions frame's storage, carried once from the shell's
// origin to the frame's own (storageCarry.ts, host.ts), is done only when all of it is written, and its edges are closed:
//   .1 a carry written in part (a key not written, the frame's recovery database not written, the host's recovery records not read)
//      is not done: the frame records that it ran uncarried, says so, and asks again at its next start;
//   .2 the host carries the frame's own keys alone (an allow-list of the frame's prefixes, pinned against every key the frame's pages
//      name); each answer names the request it answers; a document that loads while the host gathers is answered, never left to wait
//      out the ten seconds; a carried key never overwrites one the frame holds; and a frame that cannot tell its host's origin says so
//      and boots at once.
// SCRIPTED: the frame's window (its parent, its messages, its localStorage as a Map with a failing setItem where a test asks), the
// shell's storage, and an IndexedDB that fails or answers late where a test asks. REAL: the frame's carry, the host's gather and its
// answer (ExpressionsHost), the frame pages' sources the allow-list is read against.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync, existsSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ExpressionsHost, CHANNEL_VERSION} from '../src/index.ts';
import * as Carry from '../src/storageCarry.ts';

const {STORAGE_CARRY, STORAGE_CARRY_REQUEST, STORAGE_CARRY_SCHEMA, STORAGE_CARRIED_KEY, STORAGE_UNCARRIED_KEY, carryStorageFromHost, gatherStorageCarry} = Carry;
const SHELL = 'tauri://localhost', FRAME = 'oi-material://application.localhost';
const ENTRY = `${FRAME}/__application/expressions/index.html`;
const settle = () => new Promise(resolve => setImmediate(resolve));
/** Whether the carry takes a key as the frame's own (false where the module names no allow-list). */
const carried = key => typeof Carry.frameStorageKey === 'function' && Carry.frameStorageKey(key);

/** The frame's window: its parent (the host, answering by `answer`), its localStorage (a Map; `failKeys` refuse a write), its IndexedDB,
 * and the browser's record of its host (`ancestor`, `referrer`). */
function frameWindow({store = new Map(), failKeys = [], ancestor = SHELL, referrer = '', indexedDB, answer} = {}) {
  const storage = {
    getItem: key => store.has(key) ? store.get(key) : null,
    setItem(key, value) {if (failKeys.includes(key)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); store.set(key, String(value));},
    removeItem: key => {store.delete(key);},
    key: index => [...store.keys()][index] ?? null,
    get length() {return store.size;},
  };
  const target = new EventTarget();
  const deliver = (data, from = {}) => target.dispatchEvent(Object.assign(new Event('message'), {data, source: from.source ?? parent, origin: from.origin ?? SHELL}));
  const parent = {posted: [], postMessage(data, origin) {
    this.posted.push({data, origin});
    if (answer) setImmediate(() => answer(data, deliver));
  }};
  Object.assign(target, {parent, localStorage: storage, indexedDB, document: {referrer},
    location: {origin: FRAME, ancestorOrigins: ancestor ? {length: 1, 0: ancestor} : {length: 0}}});
  return {target, store, parent, deliver};
}
/** A host that answers the frame's ask with `carry`, naming its request. */
const answering = carry => (data, deliver) => deliver({v: 1, kind: STORAGE_CARRY, request_id: data.request_id, carry});
const carryOf = (local, extra = {}) => ({schema: STORAGE_CARRY_SCHEMA, from: SHELL, local, recovery: null, ...extra});
/** An IndexedDB whose opening fails, as a full disk or a blocked upgrade fails it. */
const failingIndexedDB = () => ({open() {
  const opening = {};
  setImmediate(() => {opening.error = new DOMException('The quota has been exceeded.', 'QuotaExceededError'); opening.onerror?.();});
  return opening;
}});
const quiet = t => t.mock.method(console, 'warn', () => {});

test('1R-surface.1: a carry with a key not written is not done: the frame says so, records it ran uncarried, and asks again at its next start', async t => {
  quiet(t);
  const store = new Map();
  const carry = carryOf([['oi.workspace.v1', 'the toolbelt kept at the shell'], ['oi.recent-work.v1', '["expression:kept"]']]);
  const first = frameWindow({store, failKeys: ['oi.workspace.v1'], answer: answering(carry)});
  const outcome = await carryStorageFromHost({target: first.target, timeoutMs: 5000});
  assert.equal(outcome.state, 'carried-in-part');
  assert.deepEqual(outcome.failed, ['oi.workspace.v1']);
  assert.equal(outcome.said, Carry.CARRIED_IN_PART);
  assert.equal(typeof outcome.said, 'string');
  assert.equal(store.get(STORAGE_CARRIED_KEY), undefined, 'a carry written in part is never marked done');
  assert.ok(store.has(STORAGE_UNCARRIED_KEY), 'the frame records that it ran without all of it');
  assert.equal(store.get('oi.recent-work.v1'), '["expression:kept"]', 'what was written stands');
  // The next start: the write that failed now succeeds, so the carry is asked again and done.
  const next = frameWindow({store, answer: answering(carry)});
  const again = await carryStorageFromHost({target: next.target, timeoutMs: 5000});
  assert.equal(next.parent.posted.length, 1, 'the next start asks again');
  assert.equal(again.state, 'carried');
  assert.equal(store.get('oi.workspace.v1'), 'the toolbelt kept at the shell');
  assert.ok(store.has(STORAGE_CARRIED_KEY), 'once all of it is written, the carry is done');
  const third = frameWindow({store, answer: answering(carry)});
  assert.equal((await carryStorageFromHost({target: third.target, timeoutMs: 5000})).state, 'kept');
  assert.equal(third.parent.posted.length, 0, 'and asked no more');
});

test('1R-surface.1: a carry whose recovery records the frame\'s IndexedDB did not write is not done, and is asked again', async t => {
  quiet(t);
  const store = new Map();
  const carry = carryOf([['oi.field-studies.last', 'expression:kept']], {recovery: {drafts: [{id: 'expression:kept', value: {}}]}});
  const first = frameWindow({store, indexedDB: failingIndexedDB(), answer: answering(carry)});
  const outcome = await carryStorageFromHost({target: first.target, timeoutMs: 5000});
  assert.equal(outcome.state, 'carried-in-part');
  assert.match(String(outcome.recovery_error), /not written here/);
  assert.equal(outcome.said, Carry.CARRIED_IN_PART);
  assert.equal(store.get(STORAGE_CARRIED_KEY), undefined);
  assert.ok(store.has(STORAGE_UNCARRIED_KEY));
  const next = frameWindow({store, indexedDB: failingIndexedDB(), answer: answering(carry)});
  await carryStorageFromHost({target: next.target, timeoutMs: 5000});
  assert.equal(next.parent.posted.length, 1, 'the next start asks again');
});

test('1R-surface.1: a carry the host could not read the recovery records for is not done, and is asked again', async t => {
  quiet(t);
  const store = new Map();
  const carry = carryOf([['oi.panel-sizes.v1', '{}']], {recovery_error: 'The recovery records were not read: the recovery records are held open by another window.'});
  const first = frameWindow({store, answer: answering(carry)});
  const outcome = await carryStorageFromHost({target: first.target, timeoutMs: 5000});
  assert.equal(outcome.state, 'carried-in-part');
  assert.match(String(outcome.recovery_error), /held open by another window/);
  assert.equal(store.get(STORAGE_CARRIED_KEY), undefined);
  assert.ok(store.has(STORAGE_UNCARRIED_KEY));
  const next = frameWindow({store, answer: answering(carryOf([['oi.panel-sizes.v1', '{}']]))});
  assert.equal((await carryStorageFromHost({target: next.target, timeoutMs: 5000})).state, 'carried', 'asked again, and done once all of it is read and written');
  assert.ok(store.has(STORAGE_CARRIED_KEY));
});

test('1R-surface.2: the host carries the frame\'s own keys alone, and the frame writes no other key it is given', async t => {
  quiet(t);
  const shellKeys = new Map([
    ['oi.workspace.v1', 'toolbelt'], ['oi.field-studies.journey-library.v2.doc.expression:kept#a', '{}'], ['oi.expression-recovery.drafts.d1#a', '{}'],
    ['typographic_pointcloud_saved_states', '[]'], ['oi-cradle.techne-journey.presence.v1', '{}'],
    // The shell's own: its chat's model, its drafts, its layout, its workspaces and its recovery, and the carry's own records.
    ['oi-chat-model-intent', '{"model":"x"}'], ['oi-cradle.draft.v1:flow:a', 'a chat draft'], ['oi-cradle.layout.v1', '{}'],
    ['oi-cradle.workspaces.v1', '{}'], ['oi-cradle.recovery.latest', 'r1'], [STORAGE_CARRIED_KEY, '{}'], [STORAGE_UNCARRIED_KEY, 'x'],
  ]);
  const shell = {location: {origin: SHELL}, localStorage: {get length() {return shellKeys.size;}, key: i => [...shellKeys.keys()][i] ?? null, getItem: key => shellKeys.get(key) ?? null}};
  const gathered = await gatherStorageCarry(FRAME, shell);
  assert.deepEqual(gathered.local.map(([key]) => key), ['oi.workspace.v1', 'oi.field-studies.journey-library.v2.doc.expression:kept#a',
    'oi.expression-recovery.drafts.d1#a', 'typographic_pointcloud_saved_states', 'oi-cradle.techne-journey.presence.v1']);
  // A frame given a key that is not its own (an old or a wrong host) writes it not.
  const store = new Map();
  const frame = frameWindow({store, answer: answering(carryOf([['oi.workspace.v1', 'toolbelt'], ['oi-chat-model-intent', '{"model":"x"}']]))});
  const outcome = await carryStorageFromHost({target: frame.target, timeoutMs: 5000});
  assert.equal(outcome.keys, 1);
  assert.equal(store.get('oi-chat-model-intent'), undefined);
  assert.equal(store.get('oi.workspace.v1'), 'toolbelt');
});

// The frame's pages (index, legacy, library, render) and every module their scripts load, type-only imports aside.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const APP = resolve(ROOT, 'desktop/cradle/expressions-app');
const strip = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
function framePagesModules() {
  const pages = ['index.html', 'legacy.html', 'library.html', 'render.html'];
  const entries = pages.flatMap(page => [...readFileSync(resolve(APP, page), 'utf8').matchAll(/<script[^>]*\bsrc="\/([^"]+)"/g)].map(m => resolve(APP, m[1])));
  assert.equal(entries.length, pages.length, 'each page loads its script');
  const file = base => {
    for (const suffix of ['', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx']) if (existsSync(base + suffix) && statSync(base + suffix).isFile()) return base + suffix;
    return base.endsWith('.js') ? file(base.slice(0, -3)) : null;
  };
  const seen = new Set(), queue = [...entries];
  while (queue.length) {
    const at = queue.shift();
    if (seen.has(at) || !/\.(ts|tsx|js|mjs)$/.test(at)) continue;
    seen.add(at);
    const code = strip(readFileSync(at, 'utf8')).replace(/(?:import|export)\s+type\s[^;]*?from\s*['"][^'"]+['"]/g, '');
    for (const m of code.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)) {const next = file(resolve(dirname(at), m[1])); if (next) queue.push(next);}
  }
  return seen;
}
/** Not storage keys, though named so: the carry's own messages and records, a picture's text keyword, a draft record's field. */
const NOT_A_FRAME_KEY = {
  'oi-storage-carry-request': 'the carry\'s request (a message kind)', 'oi-storage-carry': 'the carry\'s answer (a message kind)',
  'oi.expressions-storage-carry/v1': 'the carry\'s schema', [STORAGE_CARRIED_KEY]: 'the carry\'s own record, never carried',
  [STORAGE_UNCARRIED_KEY]: 'the carry\'s own record, never carried', 'oi:made-from': 'a picture\'s PNG/WebM/MP4 text keyword (capture.ts)',
  'draftBasis': 'a draft record\'s field (draftStorage.ts)',
};

test('1R-surface.2: every storage key the frame\'s pages name is one the carry takes as the frame\'s, and the shell\'s own are not', () => {
  const named = new Map();
  for (const at of framePagesModules()) {
    const code = strip(readFileSync(at, 'utf8'));
    const keys = [
      ...[...code.matchAll(/\b[A-Za-z_]*(?:KEY|PREFIX|STORAGE)[A-Za-z_]*\s*(?::\s*[A-Za-z]+\s*)?=\s*['"`]([^'"`$]+)/g)].map(m => m[1]),
      ...[...code.matchAll(/(?:getItem|setItem|removeItem|localNamespace)\(\s*['"`]([^'"`$]+)/g)].map(m => m[1]),
    ];
    for (const key of keys) named.set(key, at.slice(ROOT.length));
  }
  // The scan reads the keys it must: each family the frame keeps.
  for (const key of ['oi.workspace.v1', 'oi.expression-session.v1', 'oi.field-studies.journey-library.v2.', 'oi.expression-recovery.drafts.',
    'oi.panel-sizes.v1', 'oi.recent-work.v1', 'oi.field-studies.last', 'typographic_pointcloud_saved_states', 'pointcloud_saved_themes_v2',
    'oi-cradle.techne-journey.presence.v1']) assert.ok(named.has(key), `the frame's pages name ${key}`);
  const unclaimed = [...named].filter(([key]) => !(key in NOT_A_FRAME_KEY) && !carried(key) && !carried(`${key}x`));
  assert.deepEqual(unclaimed, [], 'a key the frame keeps that the carry would leave at the shell\'s origin');
  // The shell's own state, which its modules keep at its origin, is never the frame's.
  for (const key of ['oi-chat-model-intent', 'oi-cradle.draft.v1:flow:a', 'oi-cradle.layout.v1', 'oi-cradle.workspaces.v1', 'oi-cradle.recovery.latest',
    'oi-cradle.visuals.v1', 'oi-cradle.book.stage.v1', 'oi-settings.place.v1', STORAGE_CARRIED_KEY, STORAGE_UNCARRIED_KEY])
    assert.equal(carried(key), false, `${key} stays at the shell's origin`);
  assert.equal(carried('oi.workspace.v1'), true);
});

test('1R-surface.2: the frame takes only the answer that names its request', async t => {
  quiet(t);
  const store = new Map();
  let named = null;
  const frame = frameWindow({store, answer: (data, deliver) => {
    named = data.request_id;
    deliver({v: 1, kind: STORAGE_CARRY, carry: carryOf([['oi.workspace.v1', 'no request named']])});
    deliver({v: 1, kind: STORAGE_CARRY, request_id: 'another', carry: carryOf([['oi.workspace.v1', 'another request']])});
  }});
  const outcome = await carryStorageFromHost({target: frame.target, timeoutMs: 200});
  assert.equal(typeof named, 'string', 'the ask names its request');
  assert.ok(named.length > 0);
  assert.equal(outcome.state, 'unanswered', 'an answer naming no request, or another, is not this one\'s');
  assert.equal(store.get('oi.workspace.v1'), undefined);
  const next = frameWindow({store, answer: answering(carryOf([['oi.workspace.v1', 'this request']]))});
  assert.equal((await carryStorageFromHost({target: next.target, timeoutMs: 5000})).state, 'carried');
  assert.equal(store.get('oi.workspace.v1'), 'this request');
});

/** The host over a frame of its own origin, gathering from `shell`; `posted` holds what it sent the frame. */
function hosted(t, shell) {
  const posted = [];
  const frame = Object.assign(new EventTarget(), {src: ENTRY, closest: () => null, ownerDocument: {defaultView: shell}});
  frame.contentWindow = {postMessage(data, targetOrigin) {posted.push({data, targetOrigin});}};
  Object.defineProperty(frame, 'contentDocument', {get: () => null});
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 60_000});
  t.after(() => host.dispose());
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin: FRAME, data});
  return {frame, host, posted, deliver, carries: () => posted.filter(row => row.data?.kind === STORAGE_CARRY)};
}
const shellOf = entries => ({location: {origin: SHELL}, localStorage: {get length() {return entries.size;}, key: i => [...entries.keys()][i] ?? null, getItem: key => entries.get(key) ?? null}});

test('1R-surface.2: the host answers a request that names itself, naming it, and no request that names none', async t => {
  const {deliver, carries} = hosted(t, shellOf(new Map([['oi.workspace.v1', 'toolbelt']])));
  await deliver({v: CHANNEL_VERSION, kind: STORAGE_CARRY_REQUEST});
  assert.equal(carries().length, 0, 'a request that names none is not answered');
  await deliver({v: CHANNEL_VERSION, kind: STORAGE_CARRY_REQUEST, request_id: 'carry-1'});
  assert.equal(carries().length, 1);
  assert.equal(carries()[0].data.request_id, 'carry-1');
  assert.equal(carries()[0].targetOrigin, FRAME);
});

test('1R-surface.2: a document that loads while the host gathers is answered, never left to wait out the ten seconds', async t => {
  // The shell's recovery database opens late: the frame's document reloads while the host reads it.
  let open = null, opened = 0;
  const shell = {...shellOf(new Map([['oi.workspace.v1', 'toolbelt']])), indexedDB: {open() {
    const opening = {result: {objectStoreNames: {contains: () => false}, close() {}}};
    opened++;
    if (opened === 1) open = () => opening.onsuccess?.(); else setImmediate(() => opening.onsuccess?.());
    return opening;
  }}};
  const {frame, deliver, carries} = hosted(t, shell);
  frame.dispatchEvent(new Event('load'));
  const answered = deliver({v: CHANNEL_VERSION, kind: STORAGE_CARRY_REQUEST, request_id: 'carry-before-reload'});
  await settle();
  assert.equal(typeof open, 'function', 'the host is reading the shell\'s recovery records');
  frame.dispatchEvent(new Event('load'));
  open();
  await answered;
  assert.equal(carries().length, 1, 'the host gathered again for the new document and answered');
  assert.equal(carries()[0].data.request_id, 'carry-before-reload');
  assert.deepEqual(carries()[0].data.carry.local, [['oi.workspace.v1', 'toolbelt']]);
});

test('1R-surface.2: a carried key never overwrites one the frame already holds', async t => {
  quiet(t);
  const store = new Map([['oi.workspace.v1', 'written at the frame\'s origin']]);
  const frame = frameWindow({store, answer: answering(carryOf([['oi.workspace.v1', 'older, at the shell'], ['oi.panel-sizes.v1', '{"inspector":{"width":320,"height":0}}']]))});
  const outcome = await carryStorageFromHost({target: frame.target, timeoutMs: 5000});
  assert.equal(outcome.state, 'carried');
  assert.equal(outcome.keys, 1, 'only what the frame lacked is added');
  assert.equal(store.get('oi.workspace.v1'), 'written at the frame\'s origin');
  assert.equal(store.get('oi.panel-sizes.v1'), '{"inspector":{"width":320,"height":0}}');
});

test('1R-surface.2: a frame that cannot tell its host\'s origin says so and boots at once, asking again at its next start', async t => {
  quiet(t);
  const store = new Map();
  const frame = frameWindow({store, ancestor: null, referrer: '', answer: answering(carryOf([['oi.workspace.v1', 'toolbelt']]))});
  const carrying = carryStorageFromHost({target: frame.target});
  const outcome = await Promise.race([carrying, settle().then(settle).then(() => 'still waiting')]);
  assert.notEqual(outcome, 'still waiting', 'the frame boots without waiting for an answer that cannot be addressed');
  assert.equal(outcome.state, 'no-host-origin');
  assert.equal(outcome.said, Carry.NO_HOST_ORIGIN);
  assert.equal(typeof outcome.said, 'string');
  assert.equal(frame.parent.posted.length, 0, 'nothing is posted to an origin the frame cannot name');
  assert.equal(store.get(STORAGE_CARRIED_KEY), undefined);
  assert.ok(store.has(STORAGE_UNCARRIED_KEY));
  // The application says the words once it stands (native.ts hands them on; app.ts says them).
  const native = strip(readFileSync(resolve(APP, 'src/native.ts'), 'utf8')), app = strip(readFileSync(resolve(APP, 'field-studies-journeys/src/app.ts'), 'utf8'));
  assert.match(native, /outcome\?\.said\)\s*\(window as unknown as \{__oiStorageCarrySaid\?: string\}\)\.__oiStorageCarrySaid = outcome\.said/);
  assert.match(app, /__oiStorageCarrySaid;if\(typeof said==='string'\)toast\(said,/);
  // Once a referrer names the host, the next start asks it.
  const next = frameWindow({store, ancestor: null, referrer: `${SHELL}/app/index.html`, answer: answering(carryOf([['oi.workspace.v1', 'toolbelt']]))});
  assert.equal((await carryStorageFromHost({target: next.target, timeoutMs: 5000})).state, 'carried');
  assert.equal(next.parent.posted[0].origin, SHELL);
});
