import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Production sources in memory: the same loader as the native composition suites.
// Device widgets are sibling identities in Journey.shared.devices; no toolbelt entry.
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
const [{kernelDocumentToJourney}, {prepareCompositionEdit}, {DocumentStore}, {createRetainedNativeEditor, installNativeEditorReceiver},
  model, prefs, {applyNativeDeviceWidgetChanges, readNativeDeviceWidgets}, {createNativeEditorClient}, {ExpressionsHost}, {EXPRESSIONS_FAMILIES, loadExpressionsFamilies}] = await Promise.all([
  import(new URL('kernelDocumentBridge.ts', author)), import(new URL('kernelComposition.ts', author)), import(new URL('store.ts', author)),
  import(new URL('hostEditor.ts', author)), import(new URL('model.ts', author)), import(new URL('workspacePreferences.ts', author)),
  import(new URL('nativeDeviceWidgets.ts', boundary)), import(new URL('editorHost.ts', boundary)), import(new URL('host.ts', boundary)),
  import(new URL('expressionsFamilies.ts', boundary)),
]);
loadExpressionsFamilies();
const FAMILY_IDS = EXPRESSIONS_FAMILIES.map(family => family.id);
const {MessageChannel} = await import('node:worker_threads');

// An actual owner read-only inspection receipt (raw evidence, unchanged owner inventory).
const receiptPath = process.env.OI_NATIVE_COMPOSITION_RECEIPT ?? '/Users/admin/Central/Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence/native/material-verification-c79dab7c-8de3-4b69-87cb-ee11cce28c9f/rich-artifact-inspection-3a33a7f6-94e9-445d-b2ec-7e7f25950935.json';
const nativeDocument = JSON.parse(await readFile(receiptPath, 'utf8')).after.document;

const blocked = () => {throw Error('Native effects are closed in device-widget verification')};
const shared = devices => ({toolbelt: [], values: {}, pointer: {}, ...(devices === undefined ? {} : {devices})});
const presented = devices => {
  const document = structuredClone(nativeDocument);
  document.presentation = {schema: 'oi.journey-properties/v1', description: document.presentation?.description ?? '', loop: document.presentation?.loop ?? true, shared: shared(devices)};
  return document;
};
const ids = list => list.map(device => device.id);
function editor(devices) {
  const view = kernelDocumentToJourney(presented(devices)), store = new DocumentStore(view.journey);
  const scene = store.document.scenes.find(s => s.id === view.startSceneId) ?? store.document.scenes[0];
  const owner = createRetainedNativeEditor({store, sceneId: () => scene.id, selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: blocked, commit: async () => true, change: mutate => store.change(mutate), afterHistory: blocked, selectLocal: blocked, openEditor: blocked,
    standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false});
  return {view, store, scene, owner};
}

test('device widgets are an ordered sibling list of admitted families, with one instance per Field family', () => {
  const journey = {...model.sevenCentres(), shared: shared()};
  assert.deepEqual(readNativeDeviceWidgets(journey), []);
  assert.equal(FAMILY_IDS.length, 22);
  for (const family of FAMILY_IDS) assert.deepEqual(applyNativeDeviceWidgetChanges(journey, [{kind: 'device-add', family}]).shared.devices, [{id: family + '-1', family}]);

  let next = applyNativeDeviceWidgetChanges(journey, [{kind: 'device-add', family: 'physics'}, {kind: 'device-add', family: 'glyph'}]);
  assert.deepEqual(next.shared.devices, [{id: 'physics-1', family: 'physics'}, {id: 'glyph-1', family: 'glyph'}]);
  assert.equal(journey.shared.devices, undefined, 'the caller document is never mutated');
  next = applyNativeDeviceWidgetChanges(next, [
    {kind: 'device-add', family: 'force', after_id: 'physics-1'}, {kind: 'device-add', family: 'force'}, {kind: 'device-add', family: 'formation', after_id: null}]);
  assert.deepEqual(ids(next.shared.devices), ['formation-1', 'physics-1', 'force-1', 'glyph-1', 'force-2']);

  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-add', family: 'physics'}]), /already placed/);
  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-add', family: 'Physics'}]), /defined device family/);
  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-add', family: 'invented'}]), /defined device family/);
  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-add', family: 'medium', after_id: 'nope'}]), /no longer exists/);
  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-remove', device_id: 'nope'}]), /no longer exists/);

  const reversed = [...ids(next.shared.devices)].reverse();
  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-order', device_ids: reversed.slice(1)}]), /exactly once/);
  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-order', device_ids: [...reversed.slice(1), reversed[1]]}]), /exactly once/);
  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-order', device_ids: [...reversed.slice(1), 'nope']}]), /exactly once/);
  assert.deepEqual(ids(applyNativeDeviceWidgetChanges(next, [{kind: 'device-order', device_ids: reversed}]).shared.devices), reversed);

  const replaced = applyNativeDeviceWidgetChanges(next, [{kind: 'device-remove', device_id: 'physics-1'}, {kind: 'device-add', family: 'physics'}]);
  assert.deepEqual(ids(replaced.shared.devices), ['formation-1', 'force-1', 'glyph-1', 'force-2', 'physics-1']);

  const before = structuredClone(next);
  assert.throws(() => applyNativeDeviceWidgetChanges(next, [{kind: 'device-add', family: 'medium'}, {kind: 'device-add', family: 'physics'}]), /already placed/);
  assert.deepEqual(next, before, 'a refused batch leaves the list untouched');

  const full = applyNativeDeviceWidgetChanges(journey, Array.from({length: 64}, () => ({kind: 'device-add', family: 'force'})));
  assert.equal(full.shared.devices.length, 64);
  assert.throws(() => applyNativeDeviceWidgetChanges(full, [{kind: 'device-add', family: 'force'}]), /full/);
  assert.throws(() => applyNativeDeviceWidgetChanges(journey, Array.from({length: 65}, () => ({kind: 'device-add', family: 'force'}))), /bounded/);
  assert.throws(() => applyNativeDeviceWidgetChanges({...journey, shared: undefined}, [{kind: 'device-add', family: 'physics'}]), /no shared authoring owner/);
  assert.throws(() => applyNativeDeviceWidgetChanges(journey, [{kind: 'device-add', family: 'physics'}, {kind: 'chosen-remove', entry_id: 'x'}]), /Unsupported device-widget operation/);
});

test('composition_set carries shared.devices through the existing owner and the kernel presentation restores it', () => {
  const restored = [{id: 'force-1', family: 'force'}, {id: 'physics-1', family: 'physics'}];
  const view = kernelDocumentToJourney(presented(restored));
  assert.deepEqual(view.journey.shared.devices, restored);
  assert.equal(prepareCompositionEdit(view, structuredClone(view.journey)).changes.some(c => c.change === 'composition_set'), false, 'unchanged devices submit nothing');

  const edited = applyNativeDeviceWidgetChanges(view.journey, [{kind: 'device-remove', device_id: 'force-1'}, {kind: 'device-add', family: 'scene'}]);
  const set = prepareCompositionEdit(view, edited).changes.find(c => c.change === 'composition_set');
  assert.ok(set, 'the device list is one composition_set');
  assert.deepEqual(set.presentation.shared.devices, [{id: 'physics-1', family: 'physics'}, {id: 'scene-1', family: 'scene'}]);
  assert.deepEqual(set.presentation.shared.toolbelt, view.journey.shared.toolbelt);
});

test('a device gesture is one document change through the retained editor and reads back in order', async () => {
  const {store, owner} = editor([]);
  assert.deepEqual(owner.read().devices, []);
  const undoBefore = store.undoStack.length;
  await owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'device-add', family: 'physics'}, {kind: 'device-add', family: 'scene'}]});
  assert.equal(store.undoStack.length, undoBefore + 1, 'one gesture is one document change');
  assert.deepEqual(owner.read().devices, [{id: 'physics-1', family: 'physics'}, {id: 'scene-1', family: 'scene'}]);
  await assert.rejects(owner.apply({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'device-add', family: 'physics'}]}), /already placed/);
  assert.equal(store.undoStack.length, undoBefore + 1, 'a refused batch changes nothing');
  assert.equal(store.undo(), true);
  assert.deepEqual(owner.read().devices, []);
});

async function transport(owner, view) {
  const origin = 'http://127.0.0.1:8788', messages = new EventTarget(), target = new EventTarget(), frame = new EventTarget();
  const {port1, port2} = new MessageChannel();
  const message = (data, source) => Object.assign(new Event('message'), {data, source, origin});
  const parent = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); port2.postMessage(data)}};
  target.parent = parent; target.location = {origin};
  frame.src = origin + '/__application/expressions/index.html'; frame.closest = () => null;
  frame.contentWindow = {postMessage(data, targetOrigin) {assert.equal(targetOrigin, origin); port1.postMessage(data)}};
  const host = new ExpressionsHost(frame, {bindingId: 'device-widget-reading', owners: {channels: {}}, messageTarget: new EventTarget(), isPresented: () => true});
  port2.on('message', data => target.dispatchEvent(message(data, parent)));
  port1.on('message', data => messages.dispatchEvent(message(data, frame.contentWindow)));
  const receiver = installNativeEditorReceiver(owner, target), client = createNativeEditorClient(host, messages);
  const basis = owner.read().basis;
  try {
    await host.handleMessage({source: frame.contentWindow, origin, data: {v: 1, kind: 'oi-app-state', state: {hostMode: 'expressions', sceneCount: view.document.scenes.length, document: {id: view.document.expression_ref, name: view.document.title}, nativeScene: {expression_ref: basis.expression_ref, revision: basis.revision, scene_ref: basis.scene_ref}}}});
    return await client.request({operation: 'read'});
  } finally {
    client.dispose(); receiver?.dispose?.(); port1.close(); port2.close();
  }
}

test('the shell reading validator admits the ordered list, treats an absent list as none, and refuses malformed lists', async () => {
  const {view, owner} = editor([{id: 'physics-1', family: 'physics'}, {id: 'scene-1', family: 'scene'}]);
  const ordered = await transport(owner, view);
  assert.equal(ordered.ok, true, ordered.error);
  assert.deepEqual(ordered.reading.devices, [{id: 'physics-1', family: 'physics'}, {id: 'scene-1', family: 'scene'}]);

  const {devices: _omitted, ...withoutDevices} = owner.read();
  const older = await transport({...owner, read: () => withoutDevices}, view);
  assert.equal(older.ok, true, older.error);
  assert.deepEqual(older.reading.devices, []);

  const malformed = await transport({...owner, read: () => ({...owner.read(), devices: [{id: 'a', family: 'Physics'}]})}, view);
  assert.equal(malformed.ok, false);
  assert.match(malformed.error, /readback/);
});

test('the journey validator keeps shared.devices within the kernel bounds and leaves an absent list absent', () => {
  const journey = {...model.sevenCentres(), shared: shared([{id: 'glyph-1', family: 'glyph'}])};
  assert.deepEqual(model.validateJourney(structuredClone(journey)).shared.devices, [{id: 'glyph-1', family: 'glyph'}]);
  const refused = [
    [{id: 'a', family: 'glyph', extra: true}],
    [{id: 'a', family: 'glyph'}, {id: 'a', family: 'force'}],
    [{id: 'a', family: 'Glyph'}],
    [{id: 'a', family: 'x'.repeat(65)}],
    [{id: '', family: 'glyph'}],
    Array.from({length: 65}, (_, index) => ({id: 'd' + index, family: 'force'})),
    'not a list',
  ];
  for (const devices of refused) assert.throws(() => model.validateJourney({...journey, shared: shared(devices)}), /Invalid device widget|Device widgets require/, JSON.stringify(devices).slice(0, 80));
  assert.equal('devices' in model.validateJourney({...model.sevenCentres(), shared: shared()}).shared, false);
  const copy = prefs.validateDeviceWidgets(journey.shared.devices);
  assert.deepEqual(copy, journey.shared.devices);
  assert.notEqual(copy, journey.shared.devices);
});
