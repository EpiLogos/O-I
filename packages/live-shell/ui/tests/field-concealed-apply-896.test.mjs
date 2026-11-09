// O-I #747 round 896, 1R-surface.9 (DLW build ruling 2026-11-09, on the review of C99b, finding 12d): the concealed-field gate holds at
// apply as well as at capture. The host refuses an editor write while the field it edits is not shown (expressions-boundary host.ts
// captureTarget, FIELD_CONCEALED); the frame now refuses one too, reading what the host last told it (the native channel's 'visibility'),
// and the host tells it again before each editor request (editorHost.ts → host.tellShown), so the frame reads what the host read at capture.
// REAL: the host, the editor client, the frame's editor receiver over the retained editor and the document store, the message channel
// between them (a node MessageChannel, posted to the exact origin). SCRIPTED: the panel's presentation (isPresented) and the work (the
// native rich-glyph receipt the composition suites use).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);

const author = new URL('desktop/cradle/expressions-app/field-studies-journeys/src/', root);
const boundary = new URL('packages/expressions-boundary/src/', root);
const [{kernelDocumentToJourney}, {DocumentStore}, {createRetainedNativeEditor, installNativeEditorReceiver}, {createNativeEditorClient}, {ExpressionsHost}, {FIELD_CONCEALED}, {EDITOR_CHANNEL}, {loadExpressionsFamilies}] = await Promise.all([
  import(new URL('kernelDocumentBridge.ts', author)), import(new URL('store.ts', author)), import(new URL('hostEditor.ts', author)),
  import(new URL('editorHost.ts', boundary)), import(new URL('host.ts', boundary)), import(new URL('protocol.ts', boundary)), import(new URL('editor.ts', boundary)), import(new URL('expressionsFamilies.ts', boundary)),
]);
loadExpressionsFamilies();
const {MessageChannel} = await import('node:worker_threads');
const nativeDocument = JSON.parse(await readFile(new URL('./fixtures/native-rich-glyph-rack-r8.receipt.json', import.meta.url), 'utf8')).after.document;
const blocked = () => {throw Error('Native effects are closed here')};

function world() {
  const document = structuredClone(nativeDocument);
  document.presentation = {schema: 'oi.journey-properties/v1', description: document.presentation?.description ?? '', loop: document.presentation?.loop ?? true, shared: {toolbelt: [], values: {}, pointer: {}, devices: []}};
  const view = kernelDocumentToJourney(document), store = new DocumentStore(view.journey);
  const scene = store.document.scenes.find(s => s.id === view.startSceneId) ?? store.document.scenes[0];
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: blocked, commit: async () => true, change: (label, mutate) => store.change(label, mutate), afterHistory: blocked, selectLocal: blocked, openEditor: blocked,
    standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false});
  const origin = 'http://127.0.0.1:8788', messages = new EventTarget(), target = new EventTarget(), frame = new EventTarget();
  const {port1, port2} = new MessageChannel();
  const message = (data, source) => Object.assign(new Event('message'), {data, source, origin});
  const parent = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); port2.postMessage(data)}};
  target.parent = parent; target.location = {origin};
  frame.src = origin + '/__application/expressions/index.html'; frame.closest = () => null;
  const toFrame = [];
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); toFrame.push(data); port1.postMessage(data)}};
  const w = {shown: true, store, owner, view, toFrame, frame, origin, parent};
  w.host = new ExpressionsHost(frame, {bindingId: 'world.expressions', owners: {channels: {}}, messageTarget: new EventTarget(), isPresented: () => w.shown});
  const replies = [];
  port2.on('message', data => target.dispatchEvent(message(data, parent)));
  port1.on('message', data => {if (data?.schema === EDITOR_CHANNEL && data.kind === 'result') replies.push(data); messages.dispatchEvent(message(data, frame.contentWindow));});
  w.replies = replies;
  w.receiver = installNativeEditorReceiver(owner, target);
  w.client = createNativeEditorClient(w.host, messages);
  w.close = () => {w.client.dispose(); w.receiver.dispose(); port1.close(); port2.close(); w.host.dispose();};
  const basis = owner.read().basis;
  w.ready = () => w.host.handleMessage({source: frame.contentWindow, origin, data: {v: 1, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneCount: view.document.scenes.length,
    document: {id: view.document.expression_ref, name: view.document.title}, nativeScene: {expression_ref: basis.expression_ref, revision: basis.revision, scene_ref: basis.scene_ref}}}});
  w.add = family => w.client.request({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'device-add', family}]});
  return w;
}
const turns = async () => {for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));};

test('1R-surface.9: the concealed-field gate holds at the frame\'s apply as well as at the host\'s capture', async t => {
  const w = world();
  t.after(w.close);
  await w.ready();
  assert.equal((await w.client.request({operation: 'read'})).ok, true, 'read: the editor is admitted');
  assert.equal((await w.add('physics')).ok, true, 'shown: the write lands');
  assert.deepEqual(w.owner.read().devices.map(d => d.family), ['physics']);

  // Concealed, the host refuses at capture, in the words that name the cause.
  w.shown = false; w.host.setPresented(); await turns();
  assert.deepEqual(await w.add('scene'), {ok: false, error: FIELD_CONCEALED});
  // A write that reaches the frame after it was told the field is concealed (one captured before, or any other sender's): the frame
  // refuses it at apply, and the work is unchanged.
  const sent = w.toFrame.filter(data => data?.schema === EDITOR_CHANNEL && data.kind === 'request').at(-1);
  const undoBefore = w.store.undoStack.length;
  w.frame.contentWindow.postMessage({...sent, req: 'after-concealed', request: {...sent.request, basis: w.owner.read().basis, changes: [{kind: 'device-add', family: 'scene'}]}}, w.origin);
  await turns();
  const reply = w.replies.find(data => data.req === 'after-concealed');
  assert.equal(reply?.reply.ok, false);
  assert.equal(reply.reply.error, FIELD_CONCEALED);
  assert.equal(w.store.undoStack.length, undoBefore, 'nothing applied');
  assert.deepEqual(w.owner.read().devices.map(d => d.family), ['physics']);

  // Shown again, though the panel has not told the frame yet: the host tells it before the request, so the frame reads what the host read.
  w.shown = true;
  assert.equal((await w.add('scene')).ok, true);
  assert.deepEqual(w.owner.read().devices.map(d => d.family), ['physics', 'scene']);
  const told = w.toFrame.filter(data => data?.kind === 'visibility' || data?.schema === EDITOR_CHANNEL && data.kind === 'request').slice(-2).map(data => data.kind === 'visibility' ? `visible ${data.visible}` : data.request.operation);
  assert.deepEqual(told, ['visible true', 'apply'], 'the visibility is told just before the request');
});

// O-I #747 round 896, item 3 beside 1R-surface.9: the host tells the frame two things in one message, whether it is drawn (`visible`, its
// box laid out under nothing hidden: the draw loop) and whether its work is presented (`presented`: the editor's gate). A Session or
// Arrangement view over the field presents the work and shows the frame's residence none, and its acts on the work stand: the frame is
// told hidden, so it stops drawing, and its editor still takes the write the host admitted.
test('item 3: a field drawn nowhere under a set view is told hidden, and still takes the acts on the presented work', async t => {
  const w = world();
  t.after(w.close);
  let laidOut = true;
  w.frame.getClientRects = () => laidOut ? [{width: 640, height: 360}] : [];
  await w.ready();
  assert.equal((await w.client.request({operation: 'read'})).ok, true, 'read: the editor is admitted');
  laidOut = false; w.host.setPresented(); await turns();
  const said = w.toFrame.filter(data => data?.kind === 'visibility').at(-1);
  assert.deepEqual([said.visible, said.presented], [false, true], 'drawn nowhere, presented');
  const landed = await w.add('physics');
  assert.equal(landed.ok, true, `the write lands: ${JSON.stringify(landed)}`);
  assert.deepEqual(w.owner.read().devices.map(d => d.family), ['physics']);
  // Concealed (the work not presented), the frame refuses as before, whatever its box.
  laidOut = true; w.shown = false; w.host.setPresented(); await turns();
  assert.deepEqual(await w.add('scene'), {ok: false, error: FIELD_CONCEALED});
  assert.deepEqual(w.owner.read().devices.map(d => d.family), ['physics']);
});
