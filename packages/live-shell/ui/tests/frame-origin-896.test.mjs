// O-I #747 round 896, item 0.3 (DLW build ruling 2026-11-09): the Expressions frame has an origin of its own, so nothing the shell
// does with it may assume the shell's. Three channels assumed it in C99, and each is carried through the boundary by postMessage alone,
// checked by source and exact origin:
//   - the personal (Nara) facade refused to attach unless the frame stood at the shell's origin, and read the frame's window to guard
//     a navigation; now it attaches to the frame's exact origin, reads only its messages, and posts to it alone (cradle.ts attach,
//     naraChannel.ts `origin`);
//   - the frame's editor channel posted to, and read from, its parent at the frame's own origin; now at the host's (hostOrigin.ts,
//     hostEditor.ts installNativeEditorReceiver);
//   - the frame's storage stood at the shell's origin: the host gives it the shell's storage once, only before the frame's first state
//     (host.ts, storageCarry.ts; the carry itself runs in Chromium, frame-isolation-896.test.mjs).
// SCRIPTED: the frame's window and the shell's (their postMessage, the frame's load), and the shell's localStorage (a Map). REAL: the
// cradle owners, the Nara relay, the editor receiver, the host and the carry's gather.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {register} from 'node:module';

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.json'))return {format:'module',shortCircuit:true,source:'export default '+await readFile(new URL(url),'utf8')};
  if(url.split('?')[0].endsWith('.html')||url.split('?')[0].endsWith('.svg'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(url.split('?')[0]),'utf8'))};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

const {createCradleOwners} = await import('../../../expressions-boundary/src/cradle.ts');
const {hostOrigin} = await import('../../../expressions-boundary/src/hostOrigin.ts');
const {ExpressionsHost, CHANNEL_VERSION} = await import('../../../expressions-boundary/src/index.ts');
const {STORAGE_CARRY, STORAGE_CARRY_REQUEST, STORAGE_CARRY_SCHEMA, gatherStorageCarry} = await import('../../../expressions-boundary/src/storageCarry.ts');
const {installNativeEditorReceiver} = await import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts');
const {EDITOR_CHANNEL} = await import('../../../expressions-boundary/src/editor.ts');
const Protocol = await import('../../../expressions-boundary/src/protocol.ts');

const SHELL = 'tauri://localhost', FRAME = 'oi-material://localhost', FOREIGN = 'https://elsewhere.example';
const ENTRY = `${FRAME}/__application/expressions/index.html`;
const settle = () => new Promise(resolve => setImmediate(resolve));

/** The shell's window, as the facade sees it: its location and the messages that reach it. */
function shellWindow(t) {
  const prior = globalThis.window;
  const win = Object.assign(new EventTarget(), {location: {origin: SHELL, href: `${SHELL}/app/index.html`}});
  globalThis.window = win;
  t.after(() => {if (prior === undefined) delete globalThis.window; else globalThis.window = prior;});
  return win;
}
function frameAt(src) {
  const posted = [];
  const frame = Object.assign(new EventTarget(), {src, closest: () => null});
  frame.contentWindow = {postMessage(data, targetOrigin) {posted.push({data, targetOrigin});}};
  // A frame of another origin: its document cannot be read.
  Object.defineProperty(frame, 'contentDocument', {get: () => null});
  return {frame, posted};
}

test('the personal facade attaches to a frame of its own origin, reads only its messages, and posts to it alone', async t => {
  const win = shellWindow(t);
  const owners = createCradleOwners({kind: 'bridge', url: 'http://127.0.0.1:9'}, {project: 'O-I'});
  const {frame, posted} = frameAt(ENTRY);
  let stop = () => {};
  assert.doesNotThrow(() => {stop = owners.attach(frame, () => null);}, 'C99 refused a frame not at the shell\'s origin');
  frame.dispatchEvent(new Event('load'));
  await settle();
  const announced = posted.filter(({data}) => data?.kind === 'oi-kernel-channel');
  assert.ok(announced.length >= 1, 'the facade announces its channel to the frame once loaded');
  assert.deepEqual([...new Set(announced.map(row => row.targetOrigin))], [FRAME], 'to the frame\'s exact origin, never to any');
  // The frame's hello at another origin (a document navigated into the frame) is not read; at the frame's, it is.
  posted.length = 0;
  win.dispatchEvent(Object.assign(new Event('message'), {source: frame.contentWindow, origin: FOREIGN, data: {v: 1, kind: 'oi-kernel-hello'}}));
  await settle();
  assert.deepEqual(posted, [], 'a foreign origin\'s message reads nothing');
  win.dispatchEvent(Object.assign(new Event('message'), {source: frame.contentWindow, origin: FRAME, data: {v: 1, kind: 'oi-kernel-hello'}}));
  await settle();
  assert.deepEqual(posted.map(row => [row.data.kind, row.targetOrigin]), [['oi-kernel-channel', FRAME]]);
  // A request from another origin is never answered, to any origin.
  posted.length = 0;
  win.dispatchEvent(Object.assign(new Event('message'), {source: frame.contentWindow, origin: FOREIGN, data: {v: 1, kind: 'nara-instrument', req: 1, request: {operation: 'release_identity'}}}));
  await settle();
  assert.deepEqual(posted, []);
  stop();
});

test('the frame\'s exact origin is read from its address, a custom scheme\'s as the webview serving it gives it', () => {
  const {frameOrigin} = Protocol;
  assert.equal(new URL(ENTRY).origin, 'null', 'the URL standard reads a custom scheme\'s origin as opaque');
  assert.equal(frameOrigin(ENTRY), FRAME);
  assert.equal(frameOrigin('http://oi-material.localhost/__application/expressions/index.html'), 'http://oi-material.localhost');
  assert.equal(frameOrigin('/__application/expressions/index.html', `${SHELL}/app/index.html`), SHELL, 'C99\'s entry: the shell\'s own');
  assert.equal(frameOrigin('about:blank'), null);
  assert.equal(frameOrigin('not a url'), null);
});

test('the frame names its host by the browser\'s record of its ancestors, else its referrer, else its own origin', () => {
  const at = (extra = {}) => ({parent: {}, location: {origin: FRAME, ...extra.location}, document: extra.document});
  assert.equal(hostOrigin(at({location: {ancestorOrigins: [SHELL]}})), SHELL);
  assert.equal(hostOrigin(at({document: {referrer: `${SHELL}/app/index.html`}})), SHELL);
  assert.equal(hostOrigin(at()), FRAME, 'no record: served at its host\'s origin, as before the isolation');
  const top = {location: {origin: FRAME}}; top.parent = top;
  assert.equal(hostOrigin(top), null, 'not hosted');
});

test('the frame\'s editor channel speaks to its host at the host\'s origin, and reads only the host\'s', async t => {
  const sent = [];
  const parent = {postMessage(data, targetOrigin) {sent.push({data, targetOrigin});}};
  const target = Object.assign(new EventTarget(), {parent, location: {origin: FRAME, ancestorOrigins: [SHELL]}});
  const reading = {basis: {expression_ref: 'expression:dawn', scene_ref: 'scene:s1', revision: 1, authored_revision: 1}};
  const receiver = installNativeEditorReceiver({read: () => reading}, target);
  t.after(() => receiver.dispose());
  const ask = origin => target.dispatchEvent(Object.assign(new Event('message'), {source: parent, origin,
    data: {schema: EDITOR_CHANNEL, kind: 'request', token: 'tok', req: `r-${origin}`, bindingId: 'center:world', epoch: 1, request: {operation: 'read'}}}));
  ask(FRAME);
  await settle();
  assert.deepEqual(sent, [], 'a request at the frame\'s own origin is not its host\'s, and is not read');
  ask(SHELL);
  await settle();
  const answers = sent.filter(row => row.data?.req === `r-${SHELL}`);
  assert.equal(answers.length, 1, 'the host\'s request is answered');
  assert.equal(answers[0].targetOrigin, SHELL, 'to the host\'s origin alone');
});

test('the host gives the frame the shell\'s storage once, only before the frame\'s first state, and never to a frame at its own origin', async t => {
  const entries = new Map([['oi.workspace.v1', 'kept at the shell'], ['oi.expressions.storage-carried.v1', 'the carry\'s own record is not carried']]);
  const localStorage = {get length() {return entries.size;}, key: i => [...entries.keys()][i] ?? null, getItem: key => entries.get(key) ?? null};
  const shell = {location: {origin: SHELL}, localStorage};
  assert.equal(await gatherStorageCarry(SHELL, shell), null, 'a frame at the shell\'s own origin reads that storage itself');
  const gathered = await gatherStorageCarry(FRAME, shell);
  assert.deepEqual({...gathered, recovery_error: undefined}, {schema: STORAGE_CARRY_SCHEMA, from: SHELL, local: [['oi.workspace.v1', 'kept at the shell']], recovery: null, recovery_error: undefined});
  assert.match(gathered.recovery_error, /no IndexedDB/);
  // Through the host: asked before the frame's first state, answered to the frame's origin; once ready, not answered.
  const {frame, posted} = frameAt(ENTRY);
  frame.ownerDocument = {defaultView: shell};
  const host = new ExpressionsHost(frame, {bindingId: 'center:world', owners: {channels: {}}, messageTarget: new EventTarget(), handshakeTimeoutMs: 1000});
  t.after(() => host.dispose());
  const deliver = data => host.handleMessage({source: frame.contentWindow, origin: FRAME, data});
  await deliver({v: CHANNEL_VERSION, kind: STORAGE_CARRY_REQUEST});
  const carried = posted.filter(row => row.data?.kind === STORAGE_CARRY);
  assert.equal(carried.length, 1);
  assert.equal(carried[0].targetOrigin, FRAME);
  assert.deepEqual(carried[0].data.carry.local, [['oi.workspace.v1', 'kept at the shell']]);
  await host.handleMessage({source: frame.contentWindow, origin: FOREIGN, data: {v: CHANNEL_VERSION, kind: STORAGE_CARRY_REQUEST}});
  assert.equal(posted.filter(row => row.data?.kind === STORAGE_CARRY).length, 1, 'another origin is never answered');
  await deliver({v: CHANNEL_VERSION, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneIndex: 0, sceneCount: 1}});
  await deliver({v: CHANNEL_VERSION, kind: STORAGE_CARRY_REQUEST});
  assert.equal(posted.filter(row => row.data?.kind === STORAGE_CARRY).length, 1, 'once the frame has booted, nothing it runs is given the shell\'s storage');
});
