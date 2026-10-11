/** Real retained read; opt-in new authored acceptance work only. The original
 * human Expressions are inspected before/after and never mutated. No server,
 * fixture owner, fake receipt, file Save, or GUI acceptance is supplied here. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {register} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {messageWire} from './message-wire.mjs';
register('./editor-source-loader.mjs', import.meta.url);
const [{kernelOp}, {kernelDocumentToJourney}, {createRetainedNativeEditor, installNativeEditorReceiver}, {DocumentStore}, {NativeWorking}, {initialiseShared}, {entity, clone, blankScene}, {prepareCompositionEdit}, {readNativeChosenControls}, {NATIVE_BINDINGS}, {EDITOR_CHANNEL}, {hostedCompositionFile}] = await Promise.all([
  import('../../../desktop/cradle/src/kernel/bridge.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts'),
  import('../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelComposition.ts'),
  import('../src/chosenControls.ts'), import('../src/parameters.ts'), import('../src/editor.ts'), import('../../../desktop/cradle/src/expressions/hostedComposition.ts'),
]);
const argument = name => {const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]};
const url = argument('--kernel-url');
if (!url) throw Error('Pass --kernel-url for the already-running native owner');
const transport = {kind: 'bridge', url}, actor = 'agent:chosen-control-native-acceptance';
const originalRef = 'expression:authored-acb9d00d-e7e4-4f2f-948f-395914da17b1';
const protectedRefs = [originalRef, 'expression:techne-m0.central.dd19f55a16862f362d32617854728b2a'];
const nativeEffects = [], checks = [], acceptance = {};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const operation = async (op, request) => {
  if (op === 'expression' && !['inspect', 'list', 'capabilities'].includes(request.operation)) {
    assert.ok(request.expression_ref?.startsWith('expression:chosen-control-acceptance-'), 'Only this explicitly separate acceptance work may be mutated');
    assert.ok(!protectedRefs.includes(request.expression_ref));
  }
  const response = await kernelOp(transport, {op, request}, AbortSignal.timeout(30000));
  assert.equal(response.error, undefined, response.error);
  assert.equal(response.outcome?.result, op);
  if (op === 'expression' && !['inspect', 'list', 'capabilities'].includes(request.operation)) nativeEffects.push({operation: request.operation, expression_ref: request.expression_ref, expected_revision: request.expected_revision, state: response.outcome.data.state, revision: response.outcome.data.document?.revision});
  return response.outcome.data;
};
const inspect = async ref => {const result = await operation('expression', {operation: 'inspect', expression_ref: ref}); assert.equal(result.document?.expression_ref, ref); return result.document};
const before = new Map();
for (const ref of protectedRefs) before.set(ref, await inspect(ref));
const view = kernelDocumentToJourney(before.get(originalRef)), sceneId = view.startSceneId ?? view.journey.scenes[0].id;
const store = new DocumentStore(view.journey);
const noEffects = () => {assert.fail('The protected retained reader cannot invoke an owner mutation')};
const reader = createRetainedNativeEditor({store, sceneId: () => sceneId, nativeView: () => view,
  selection: () => ({entity_ids: [], step_id: null}), nativeSelect: noEffects, commit: noEffects, change: noEffects,
  afterHistory: noEffects, selectLocal: noEffects, openEditor: noEffects,
  standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => true});
const check = async (name, work) => {await work(); checks.push({name, passed: true})};
await check('reading exposes exact shared owner entries and order without adopting scene legacy controls', () => {
  const reading = reader.read();
  assert.deepEqual(reading.chosenControls.entries, view.journey.shared?.toolbelt ?? []);
  assert.equal(reading.chosenControls.available, !!view.journey.shared);
  assert.deepEqual(reading.chosenControls.controls.map(control => control.entry_id), reading.chosenControls.entries.map(entry => entry.id));
  assert.deepEqual(store.document, view.journey);
});
await check('actual retained definitions and native object refs resolve without invented effective telemetry', () => {
  const reading = reader.read();
  for (const control of reading.chosenControls.controls) {
    assert.equal(control.effective_value, null);
    if (control.unavailable_reason) {assert.equal(control.target, null); assert.equal(control.binding, null); continue;}
    assert.ok(control.binding); assert.equal(typeof control.base_value, 'number');
    if (control.entity_id) assert.equal(control.native_ref, reading.entityOccurrences[control.entity_id]);
    else assert.ok(NATIVE_BINDINGS.some(binding => binding.key === control.binding.key));
  }
});
await check('Follow without retained selection remains unavailable instead of routing another formation', () => {
  const reading = reader.read();
  for (const entry of reading.chosenControls.entries.filter(entry => entry.scope === 'selected')) {
    const control = reading.chosenControls.controls.find(control => control.entry_id === entry.id);
    assert.equal(control.target, null); assert.match(control.unavailable_reason, /Select an object/);
  }
});
await check('current chosen-control resolution is independent of entity display order', () => {
  const reading = reader.read(), reversed = clone(reading.scene); reversed.entities.reverse();
  const chosen = readNativeChosenControls(store.document, reversed, {entity_ids: reading.selection.entity_ids, entityOccurrences: reading.entityOccurrences});
  for (const control of reading.chosenControls.controls) if (reading.chosenControls.entries.find(entry => entry.id === control.entry_id)?.scope !== 'selected') assert.deepEqual(chosen.controls.find(row => row.entry_id === control.entry_id), control);
  assert.deepEqual(prepareCompositionEdit(view, store.document).changes, []);
});

if (process.argv.includes('--exercise-new-work')) {
  const evidenceDirectory = argument('--evidence-directory');
  if (!evidenceDirectory || !evidenceDirectory.startsWith('Work/reverse-engineering/2026-10-07-techne-instrument-re/new-shell/evidence')) throw Error('Pass the bounded programme --evidence-directory for the separate acceptance file');
  const ref = `expression:chosen-control-acceptance-${crypto.randomUUID()}`;
  acceptance.expression_ref = ref;
  const created = await operation('expression', {operation: 'create', expression_ref: ref, title: 'Chosen control owner acceptance', actor});
  assert.equal(created.state, 'ready');
  const checkpointIds = new Set();
  const checkpoint = async (id, value) => {
    checkpointIds.add(id);
    const prior = await operation('expression_recovery', {operation: 'read', scope: 'expressions', kind: 'checkpoint', id});
    const written = await operation('expression_recovery', {operation: 'write', scope: 'expressions', kind: 'checkpoint', id, expected_revision: prior.record?.revision ?? null, value});
    assert.equal(written.state, 'written');
  };
  const fileReceipts = [];
  const working = new NativeWorking({expression: request => operation('expression', request), checkpoint,
    file: async request => {
      assert.equal((request.document ?? request.intent?.document)?.expression_ref, ref);
      if (request.operation === 'prepare') assert.equal(request.destination.parent_path, evidenceDirectory);
      const result = await hostedCompositionFile(transport, request);
      if (request.operation !== 'prepare') fileReceipts.push({operation: request.operation, result});
      return result;
    }, mint: noEffects});
  const seed = await working.adopt(created.document), workStore = new DocumentStore(seed.journey), workSceneId = seed.journey.scenes[0].id;
  workStore.change(document => {
    initialiseShared(document); document.shared.toolbelt = [];
    document.scenes[0].entities.push(entity('First authored object', 'A'), entity('Second authored object', 'B', {x: 1, y: 0, z: 0}));
    document.scenes.push(blankScene('Empty section for bound-target absence'));
  });
  let selected = [workStore.document.scenes[0].entities[0].id];
  const snapshot = () => ({journey: workStore.document, sceneId: workSceneId, entityId: selected[0] ?? null});
  await working.commit(snapshot());
  const owner = createRetainedNativeEditor({store: workStore, sceneId: () => workSceneId, nativeView: () => working.state.view,
    selection: () => ({entity_ids: [...selected], step_id: null}), nativeSelect: async (id, entityId) => {
      const basis = working.state.view; await working.select({scene_ref: basis.bindings[id].scene_ref, entity_ref: basis.bindings[id].occurrences.find(row => row.view_entity_id === entityId).entity_ref}); return 'applied';
    }, commit: async () => {await working.commit(snapshot()); return true}, change: mutate => workStore.change(mutate),
    afterHistory: () => {}, selectLocal: id => {selected = [id]}, openEditor: noEffects,
    standing: () => ({busy: !!working.state.pending, notice: null}), telemetry: () => undefined, fieldPaused: () => true});
  const wire = messageWire(), target = new EventTarget(), origin = 'http://127.0.0.1:8789';
  target.location = {origin}; target.parent = {postMessage(data, expected) {assert.equal(expected, origin); wire.port1.postMessage(data)}};
  const receiver = installNativeEditorReceiver(owner, target);
  let requestId = 0;
  const request = async request => {
    const req = `chosen-${++requestId}`, event = new Event('message');
    Object.assign(event, {source: target.parent, origin, data: {schema: EDITOR_CHANNEL, kind: 'request', token: 'chosen-native-acceptance', bindingId: 'chosen-native-acceptance', epoch: 0, req, request}});
    target.dispatchEvent(event);
    // Receive delivery happens after a real native acknowledgement; MessageChannel
    // FIFO barriers observe carriers without fabricating operation results.
    for (let i = 0; i < 600; i++) {
      await wire.observe(); const reply = wire.messages.find(row => row.kind === 'result' && row.req === req)?.reply;
      if (reply) return reply; await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error('The real owner did not return its correlated chosen-control outcome');
  };
  const apply = async changes => {const response = await request({operation: 'apply', basis: owner.read().basis, changes}); assert.equal(response.ok, true, response.error); return response.reading};
  try {
    assert.equal((await request({operation: 'read'})).ok, true);
    let field, follow, bound;
    await check('new authored work acknowledges Field, Follow and Bind pins with stable native-minted IDs', async () => {
      const second = workStore.document.scenes[0].entities[1];
      const reading = await apply([{kind: 'chosen-add', scope: 'field', key: 'timeScale'}, {kind: 'chosen-add', scope: 'selected', key: 'forces.radius'}, {kind: 'chosen-add', scope: 'named', key: 'x', entity_id: second.id}]);
      [field, follow, bound] = reading.chosenControls.entries;
      assert.equal(new Set([field.id, follow.id, bound.id]).size, 3);
      assert.equal(reading.chosenControls.controls[1].entity_id, selected[0]);
      const native = await inspect(ref), stored = native.presentation.shared.toolbelt;
      assert.equal(stored[2].entityId, reading.entityOccurrences[second.id]);
      assert.deepEqual(stored.map(row => row.id), [field.id, follow.id, bound.id]);
    });
    await check('Follow captures the selected native target while Bind preserves its exact object', async () => {
      const second = workStore.document.scenes[0].entities[1];
      const before = owner.read().chosenControls.controls;
      const result = await request({operation: 'select', basis: owner.read().basis, entity_id: second.id});
      assert.equal(result.ok, true, result.error);
      assert.notEqual(result.reading.chosenControls.controls[1].target, before[1].target);
      assert.equal(result.reading.chosenControls.controls[2].target, before[2].target);
      const radius = result.reading.chosenControls.controls[1], value = Math.min(radius.binding.hardMax, radius.base_value + radius.binding.step);
      const tuned = await apply([{kind: 'parameter', target: radius.target, value}]);
      assert.equal(tuned.chosenControls.controls[1].base_value, value);
      const observed = kernelDocumentToJourney(await inspect(ref)), observedScene = observed.journey.scenes[0];
      const nativeRef = tuned.entityOccurrences[second.id], observedId = observed.bindings[observedScene.id].occurrences.find(row => row.entity_ref === nativeRef).view_entity_id;
      assert.equal(observedScene.entities.find(row => row.id === observedId).force.radius, value);
    });
    await check('scope changes and complete reorder retain identities and native composition acknowledgement', async () => {
      const first = workStore.document.scenes[0].entities[0];
      const reading = await apply([{kind: 'chosen-scope', entry_id: follow.id, scope: 'named', entity_id: first.id}, {kind: 'chosen-order', entry_ids: [bound.id, field.id, follow.id]}]);
      assert.deepEqual(reading.chosenControls.entries.map(row => row.id), [bound.id, field.id, follow.id]);
      assert.equal(reading.chosenControls.entries[2].entityId, first.id);
      assert.equal((await inspect(ref)).presentation.shared.toolbelt[2].entityId, reading.entityOccurrences[first.id]);
      const followed = await apply([{kind: 'chosen-scope', entry_id: follow.id, scope: 'selected'}]);
      assert.equal(followed.chosenControls.entries[2].entityId, undefined);
    });
    await check('stale authoring basis and invalid batches preserve both native work and retained history', async () => {
      const prior = await inspect(ref), revision = workStore.revision, entries = clone(workStore.document.shared.toolbelt), undo = workStore.undoStack.length;
      const stale = await request({operation: 'apply', basis: {...owner.read().basis, authored_revision: revision + 1}, changes: [{kind: 'chosen-remove', entry_id: field.id}]});
      assert.equal(stale.ok, false); assert.match(stale.error, /authoring revision|captured scene/i);
      const invalid = await request({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'chosen-remove', entry_id: field.id}, {kind: 'chosen-order', entry_ids: [follow.id, follow.id]}]});
      assert.equal(invalid.ok, false); assert.match(invalid.error, /every chosen control/i);
      const undefinedProperty = await request({operation: 'apply', basis: owner.read().basis, changes: [{kind: 'chosen-add', scope: 'field', key: 'invented-property'}]});
      assert.equal(undefinedProperty.ok, false); assert.match(undefinedProperty.error, /native definition/i);
      assert.deepEqual(workStore.document.shared.toolbelt, entries); assert.equal(workStore.undoStack.length, undo);
      assert.equal(hash(await inspect(ref)), hash(prior));
    });
    await check('remove, native Undo and Redo restore the actual chosen-control order', async () => {
      const prior = clone(owner.read().chosenControls.entries);
      const removed = await apply([{kind: 'chosen-remove', entry_id: bound.id}]); assert.equal(removed.chosenControls.entries.length, prior.length - 1);
      const undo = await request({operation: 'undo', basis: owner.read().basis}); assert.equal(undo.ok, true, undo.error); assert.deepEqual(undo.reading.chosenControls.entries, prior);
      const redo = await request({operation: 'redo', basis: owner.read().basis}); assert.equal(redo.ok, true, redo.error); assert.deepEqual(redo.reading.chosenControls.entries, removed.chosenControls.entries);
      assert.deepEqual((await inspect(ref)).presentation.shared.toolbelt.map(row => row.id), removed.chosenControls.entries.map(row => row.id));
    });
    await check('fresh native reopen retains chosen order and binds native object refs back to view IDs', async () => {
      const observed = await inspect(ref), reopened = kernelDocumentToJourney(observed), selectedScene = reopened.journey.scenes[0];
      const controls = readNativeChosenControls(reopened.journey, selectedScene, {entity_ids: [], entityOccurrences: Object.fromEntries(reopened.bindings[selectedScene.id].occurrences.map(row => [row.view_entity_id, row.entity_ref]))});
      assert.deepEqual(controls.entries.map(row => row.id), owner.read().chosenControls.entries.map(row => row.id));
      assert.equal(controls.controls.length, controls.entries.length);
      acceptance.revision = observed.revision; acceptance.document_sha256 = hash(observed);
      acceptance.checkpoint_ids = [...checkpointIds];
    });
    await check('bound control absence in another real authored Scene is explicit and never retargeted', async () => {
      const first = workStore.document.scenes[0].entities[0];
      await apply([{kind: 'chosen-scope', entry_id: follow.id, scope: 'named', entity_id: first.id}]);
      const observed = kernelDocumentToJourney(await inspect(ref)), empty = observed.journey.scenes[1];
      const controls = readNativeChosenControls(observed.journey, empty, {entity_ids: [], entityOccurrences: Object.fromEntries(observed.bindings[empty.id].occurrences.map(row => [row.view_entity_id, row.entity_ref]))});
      const absent = controls.controls.find(row => row.entry_id === follow.id);
      assert.equal(absent.target, null); assert.match(absent.unavailable_reason, /bound object is absent/);
    });
    await check('native artifact Save and actual file reopen preserve complete chosen order and bindings', async () => {
      const expected = await inspect(ref), name = `sol-chosen-controls-${ref.slice('expression:chosen-control-acceptance-'.length)}.expression.json`;
      const file = await working.saveFile(snapshot(), {parent_path: evidenceDirectory, name});
      assert.equal(file.expression_ref, ref); assert.equal(file.location.path, `${evidenceDirectory}/${name}`); assert.ok(file.revision);
      const reopened = await hostedCompositionFile(transport, {operation: 'open', path: file.location.path});
      assert.equal(hash(reopened.document), hash(expected)); assert.deepEqual(reopened.file.location, file.location); assert.equal(reopened.file.revision, file.revision);
      const converted = kernelDocumentToJourney(reopened.document);
      assert.deepEqual(converted.journey.shared.toolbelt.map(row => row.id), owner.read().chosenControls.entries.map(row => row.id));
      assert.equal(working.state.pending, undefined); assert.deepEqual(working.state.file, file);
      acceptance.revision = reopened.document.revision; acceptance.document_sha256 = hash(reopened.document);
      acceptance.file = file; acceptance.file_receipts = fileReceipts; acceptance.checkpoint_ids = [...checkpointIds];
      acceptance.standing = 'retained open with native checkpoint and unique saved acceptance file for parent GUI replay';
    });
  } finally {receiver.dispose(); wire.dispose();}
}
await check('both existing human Expressions remain byte-for-value unchanged after all acceptance activities', async () => {
  for (const ref of protectedRefs) assert.equal(hash(await inspect(ref)), hash(before.get(ref)), ref);
});
const report = {grade: 'B', claim: 'retained chosen-control owner reading; optional separate authored native pin/order/scope/tuning/history/artifact Save/reopen; no GUI or human-work Save claim', kernel_url: url, passed: checks.length, faults: 0, checks,
  protected_documents: [...before].map(([ref, document]) => ({expression_ref: ref, revision: document.revision, sha256: hash(document), native_writes: 0})), acceptance, native_effects: nativeEffects};
const output = new URL(`../.artifacts/chosen-controls-${acceptance.expression_ref?.slice('expression:'.length) ?? 'retained-read'}.json`, import.meta.url);
await mkdir(new URL('../.artifacts/', import.meta.url), {recursive: true});
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
