// Seam B: a non-Expression palace object's instrument summon carries the object ref. The host forwards the ref with the
// lens it selects; the retained-instrument capture carries an optional focus ref and validates it at the host. Nothing
// is guessed: a malformed ref is refused, and an instrument summon without a ref behaves exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {readFile} from 'node:fs/promises';
const root = new URL('../../../../', import.meta.url);
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href)};
import {readFile} from 'node:fs/promises';
export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;for(const suffix of ['.ts','.tsx'])try{return await n(s.endsWith('.js')?s.slice(0,-3)+suffix:s+suffix,c)}catch{}throw e}}
export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(!/\\.tsx?$/.test(u))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:u}).outputText}}
`)}`, import.meta.url);
const api = await import('../src/native/techneInstrumentOpen.ts');
const {ExpressionsHost, CHANNEL_VERSION} = await import('@epilogos/expressions-boundary');

const EXPRESSION = 'expression:palace-probe';
const scope = {workspaceId: 'ws', accessEpoch: 2, accessReady: true, nativeAccessCurrent: epoch => epoch === 2, mode: 'techne',
  editorReading: {basis: {expression_ref: EXPRESSION, scene_ref: 'scene:one', revision: 3, authored_revision: 1},
    selection: {entity_ids: [], step_id: null}, standing: {pending: false, dirty: false}}};
const hostFake = (calls) => ({bindingId: 'world.expressions', isReady: () => true,
  getState: () => ({nativeScene: {expression_ref: EXPRESSION, scene_ref: 'scene:one', revision: 3}}),
  selectInstrument: (lens, ref) => calls.push([lens, ref])});
const receiver = calls => ({host: hostFake(calls), current: () => scope, isPresented: () => true});

test('a captured instrument open carries an optional focus ref, and a malformed one is refused at capture', () => {
  const input = api.captureTechneInstrumentOpen(scope, 'palace', 'world.expressions', 'wiki:node:probe');
  assert.equal(input.focus_ref, 'wiki:node:probe');
  assert.throws(() => api.captureTechneInstrumentOpen(scope, 'palace', 'world.expressions', 'bad\u0000ref'), /bounded text/);
  assert.equal('focus_ref' in api.captureTechneInstrumentOpen(scope, 'timeline'), false, 'no ref means no focus ref');
});

test('the retained host receives the lens with the focus ref it was asked for', () => {
  const calls = [];
  const result = api.openRetainedTechneInstrument(receiver(calls), api.captureTechneInstrumentOpen(scope, 'palace', 'world.expressions', 'wiki:node:probe'));
  assert.deepEqual(calls, [['palace', 'wiki:node:probe']]);
  assert.deepEqual(result, {state: 'requested', lens: 'palace'});
});

test('an instrument open without a ref selects the lens exactly as before', () => {
  const calls = [];
  api.openRetainedTechneInstrument(receiver(calls), api.captureTechneInstrumentOpen(scope, 'timeline'));
  assert.deepEqual(calls, [['timeline', undefined]]);
});

test('the host summon forwards the palace object ref with the lens, and a malformed summon ref is not guessed', async () => {
  const posted = [];
  const frame = new EventTarget();
  const origin = 'http://127.0.0.1:8788';
  frame.src = `${origin}/__application/expressions/index.html`;
  frame.contentWindow = {postMessage: (data) => posted.push(data)};
  frame.closest = () => null;
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000});
  try {
    const deliver = data => host.handleMessage({source: frame.contentWindow, origin, data});
    await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1,
      nativeScene: {expression_ref: EXPRESSION, revision: 3, scene_ref: 'scene:one'}}});
    posted.length = 0;
    await deliver({v: CHANNEL_VERSION, kind: 'host-request', request: 'summon', detail: {kind: 'instrument', lens: 'palace', ref: 'wiki:node:probe'}});
    const lens = posted.find(message => message.kind === 'host-command' && message.command === 'lens');
    assert.deepEqual(lens, {v: CHANNEL_VERSION, kind: 'host-command', command: 'lens', lens: 'palace', ref: 'wiki:node:probe'});
    posted.length = 0;
    await deliver({v: CHANNEL_VERSION, kind: 'host-request', request: 'summon', detail: {kind: 'instrument', lens: 'palace', ref: 'bad\u0000ref'}});
    assert.equal(posted.some(message => message.kind === 'host-command'), false, 'a malformed ref summons nothing');
    posted.length = 0;
    await deliver({v: CHANNEL_VERSION, kind: 'host-request', request: 'summon', detail: {kind: 'instrument', lens: 'timeline'}});
    const bare = posted.find(message => message.kind === 'host-command' && message.command === 'lens');
    assert.deepEqual(bare, {v: CHANNEL_VERSION, kind: 'host-command', command: 'lens', lens: 'timeline'}, 'no ref, no ref key');
  } finally {host.dispose();}
});
