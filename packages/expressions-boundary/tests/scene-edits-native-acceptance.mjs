/** Genuine new native work, native checkpoints/CAS replies and owning file
 * save/readback/reopen. Protected owner compositions are inspect-only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge.ts';
import {hostedCompositionFile} from '../../../desktop/cradle/src/expressions/hostedComposition.ts';
import {readFile} from '../../../desktop/cradle/src/files/client.ts';
import {NativeWorking} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {prepareCompositionEdit, acceptCompositionReply} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelComposition.ts';
import {entity, blankScene, clone} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {sceneSaveState, saveScene, restoreScene} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneWorkflow.ts';
import {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts';
import {createRetainedNativeEditor} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts';
import {expressionTiming} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/propertyTracks.ts';
import {createNativeSceneEditHandler, prepareNativeSceneEdit, prepareNativeSceneSnapshot} from '../src/sceneEdits.ts';

const arg = name => {const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1]};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const protectedRefs = ['expression:authored-acb9d00d-e7e4-4f2f-948f-395914da17b1',
  'expression:techne-m0.central.dd19f55a16862f362d32617854728b2a',
  'expression:chosen-control-acceptance-69bfc51d-4d5e-49fc-87b8-c61b744d5b42'];

export async function runNativeSceneEditAcceptance(source_sha256 = {}) {
  const url = arg('--kernel-url'), directory = arg('--evidence-directory');
  const receiverOnly = process.argv.includes('--receiver-only'), retainedRef = arg('--expression-ref');
  if (!url || !directory || !/^Work\/reverse-engineering\/2026-10-07-techne-instrument-re\/new-shell\/evidence\/[a-zA-Z0-9_.-]+$/.test(directory))
    throw Error('Pass --kernel-url and a new bounded campaign --evidence-directory');
  const path = `/Users/admin/Central/${directory}`;
  await mkdir(path); // Refuse overwriting a prior acceptance increment.
  if (receiverOnly && !/^expression:scene-core-acceptance-[a-f0-9-]{36}$/.test(retainedRef ?? ''))
    throw Error('Receiver-only checks require this packet’s existing safe native acceptance work');
  const transport = {kind: 'bridge', url}, ref = receiverOnly ? retainedRef : `expression:scene-core-acceptance-${crypto.randomUUID()}`;
  const checks = [], effects = [], recoveryIds = new Set(), original = new Map(), fileEffects = [];
  const evidence = {schema: 'oi.native-scene-edit-acceptance/v1', expression_ref: ref, kernel_url: url,
    executed_at: new Date().toISOString(), mode: receiverOnly ? 'receiver-only-existing-acceptance-work' : 'scene-core-and-join',
    source_sha256, checks, effects, file_effects: fileEffects,
    protected_documents: [], acquisition: {reuse: 'B — existing Journey, composition, native checkpoint and file owners', adapter: 'D — ref-addressed integration only'},
    ui_admitted: false, original_126_targets_admitted: false};
  const operation = async (op, request) => {
    if (op === 'expression' && !['inspect', 'list', 'capabilities'].includes(request.operation))
      assert.equal(request.expression_ref ?? request.document?.expression_ref, ref, 'Only this newly created native acceptance work may be mutated');
    if (op === 'expression_recovery') assert.ok(recoveryIds.has(request.id), 'Only this work’s actual checkpoint IDs may be read or written');
    const response = await kernelOp(transport, {op, request}, AbortSignal.timeout(45000));
    assert.equal(response.error, undefined, response.error); assert.equal(response.outcome?.result, op);
    if (op !== 'expression' || request.operation !== 'inspect') effects.push({op, request: clone(request), state: response.outcome.data.state,
      revision: response.outcome.data.document?.revision, native_receipts: response.outcome.receipts ?? []});
    return response.outcome.data;
  };
  const inspect = async expression_ref => {
    const result = await operation('expression', {operation: 'inspect', expression_ref});
    assert.equal(result.document?.expression_ref, expression_ref); return result.document;
  };
  const check = async (name, work) => {
    if (receiverOnly && !name.startsWith('receiver:') && !protectedRefs.some(ref => name.startsWith(ref))) return;
    await work(); checks.push({name, passed: true});
  };
  const checkpoint = async (id, value) => {
    recoveryIds.add(id);
    const before = await operation('expression_recovery', {operation: 'read', scope: 'expressions', kind: 'checkpoint', id});
    const saved = await operation('expression_recovery', {operation: 'write', scope: 'expressions', kind: 'checkpoint', id,
      expected_revision: before.record?.revision ?? null, value});
    assert.equal(saved.state, 'written');
  };
  // A deterministic scheduling gate delays a real request, never replaces a
  // native operation/reply. It permits actual competing edits while awaiting.
  let beforeEdit;
  const working = new NativeWorking({expression: async request => {
    if (request.operation === 'edit' && beforeEdit) {const hook = beforeEdit; beforeEdit = undefined; await hook(request)}
    return operation('expression', request);
  }, checkpoint,
    mint: () => {throw Error('This work was explicitly created at the native owner')},
    file: async request => {
      assert.equal((request.document ?? request.intent?.document)?.expression_ref, ref);
      if (request.operation === 'prepare') assert.equal(request.destination.parent_path, directory);
      const result = await hostedCompositionFile(transport, request); fileEffects.push({operation: request.operation, result}); return result;
    }});
  const view = () => working.state.view;
  let store, currentId, intentEpoch = 0, owner;
  const apply = async intent => {
    const captured = view(), basisHash = hash(captured), plan = prepareNativeSceneEdit(captured, captured.journey, intent);
    assert.equal(hash(captured), basisHash, 'Preparing an edit never mutates the retained reading');
    assert.deepEqual(plan.request, prepareCompositionEdit(captured, plan.snapshot.journey,
      {sceneId: plan.snapshot.sceneId, entityId: plan.snapshot.entityId}));
    const reply = await working.commit(plan.snapshot);
    assert.equal(reply.expression_ref, ref); assert.equal(reply.revision, captured.document.revision + 1);
    assert.deepEqual(await inspect(ref), reply, 'Independent native inspect agrees with the acknowledged operation');
    if (store) {store.acknowledge(view().journey); currentId = plan.snapshot.sceneId; intentEpoch++;}
    return plan;
  };
  try {
    for (const protectedRef of protectedRefs) original.set(protectedRef, await inspect(protectedRef));
    if (receiverOnly) await working.adopt(await inspect(ref));
    else {
      const created = await operation('expression', {operation: 'create', expression_ref: ref, title: 'Scene core owner acceptance', actor: 'agent:scene-core-acceptance'});
      assert.equal(created.state, 'ready');
      const initial = await working.adopt(created.document), authored = clone(initial.journey);
      authored.scenes[0].name = 'Opening'; authored.scenes[0].duration = 7; authored.scenes[0].transition = .5;
      authored.scenes[0].entities.push(entity('First retained occurrence', 'A'), entity('Second retained occurrence', 'B', {x: .2, y: 0, z: 0}));
      const next = blankScene('Closing'); next.duration = 13; next.transition = 2; authored.scenes.push(next);
      await working.commit({journey: authored, sceneId: authored.scenes[0].id, entityId: null});
    }
    store = new DocumentStore(view().journey); currentId = view().startSceneId;
    const observations = [];
    const observe = (event, details = {}) => observations.push({event, ...details, native_revision: view().document.revision,
      native_selection: clone(view().document.selection), presented_scene_id: currentId});
    const unavailable = () => {throw Error('This bounded retained receiver has no renderer or unrelated editor operation')};
    const entityId = () => {const native = view().document.selection;
      return native?.scene_ref === view().bindings[currentId].scene_ref && native.entity_ref ? view().entity_ids[native.entity_ref] : null};
    owner = createRetainedNativeEditor({store, sceneId: () => currentId, nativeView: view,
      selection: () => ({entity_ids: entityId() ? [entityId()] : [], step_id: null}),
      nativeSelect: async (id, entityId) => {
        const binding = view().bindings[id], occurrence = entityId ? binding.occurrences.find(row => row.view_entity_id === entityId) : null;
        if (entityId) assert.ok(occurrence, 'Only this exact Scene’s loaded occurrence can be selected');
        await working.select({scene_ref: binding.scene_ref, entity_ref: occurrence?.entity_ref ?? null});
        observe('native-focus-ack'); return 'applied';
      },
      commit: async () => {await working.commit({journey: store.document, sceneId: currentId, entityId: entityId()}); store.acknowledge(view().journey); return true},
      change: mutate => store.change(mutate), afterHistory: unavailable,
      selectLocal: (id, step) => {assert.equal(step, 0); assert.equal(view().entity_ids[view().document.selection.entity_ref], id); observe('local-occurrence', {entity_id: id})},
      openEditor: unavailable,
      standing: () => ({busy: !!working.state.pending, notice: null}), telemetry: () => undefined, fieldPaused: () => true,
      sceneControls: {
        // Stopped local disclosure in this retained port harness. No advancing
        // clock, particle telemetry or application GUI acceptance is claimed.
        read: () => ({scene_ref: view().bindings[currentId].scene_ref, scene_elapsed_seconds: 0,
          expression_time_seconds: expressionTiming(store.document, store.document.scenes.findIndex(scene => scene.id === currentId), 0).time,
          scene_playing: false, saved_sequence_playing: false, field_paused: true, track_preview: false, intent_epoch: intentEpoch}),
        recording: () => false,
        focus: id => {assert.equal(view().document.selection.scene_ref, view().bindings[id].scene_ref); currentId = id; intentEpoch++; observe('local-scene')},
        transport: action => {assert.equal(action, 'play'); intentEpoch++; observe('transport-callback', {action})},
        seek: seconds => {assert.equal(seconds, 0); intentEpoch++; observe('seek-callback', {seconds})},
        snapshot: input => {intentEpoch++; store.change(document => {
          const scene = document.scenes.find(row => row.id === currentId);
          if (input.action === 'restore-snapshot') assert.equal(restoreScene(document, scene.id), true);
          else {assert.equal(input.next, false); saveScene(document, scene, input.name);}
        });},
      },
    });
    const snapshot = async intent => {
      const request = prepareNativeSceneSnapshot(owner.read(), intent), before = view().document.revision;
      await owner.scene(request);
      assert.equal(view().document.revision, before + 1); assert.deepEqual(await inspect(ref), view().document);
    };
    const opening = receiverOnly ? view().document.scenes.find(scene => scene.entity_refs.length && scene.scene_ref !== view().document.selection.scene_ref)?.scene_ref
      : view().document.scenes[0].scene_ref;
    const closing = receiverOnly ? view().document.scenes.find(scene => !scene.entity_refs.length)?.scene_ref : view().document.scenes[1].scene_ref;
    assert.ok(opening && closing, 'This safe work must expose a real populated Scene and an empty Scene');
    const objects = hash(view().document.entities), relations = hash(view().document.relations ?? {});
    let duplicate = receiverOnly ? view().document.scenes.find(scene => scene.entity_refs.length && scene.scene_ref !== opening)?.scene_ref : undefined;
    await check('rename and pacing acknowledge exact native ref, title, bounds and unchanged object identities', async () => {
      await working.select({scene_ref: opening, entity_ref: view().document.scenes[0].entity_refs[0]});
      const selected = clone(view().document.selection);
      await apply({operation: 'rename', scene_ref: opening, title: 'Opening section'});
      await apply({operation: 'pacing', scene_ref: opening, duration: 9.25, transition: .75});
      const scene = view().document.scenes.find(row => row.scene_ref === opening);
      assert.equal(scene.title, 'Opening section'); assert.equal(scene.presentation.scene.duration, 9.25);
      assert.equal(scene.presentation.scene.transition, .75); assert.equal(hash(view().document.entities), objects);
      assert.equal(hash(view().document.relations ?? {}), relations);
      assert.deepEqual(view().document.selection, selected);
    });
    await check('invalid pacing and non-permutation order refuse before native effects', async () => {
      const prior = hash(await inspect(ref)), count = effects.length;
      for (const intent of [{operation: 'pacing', scene_ref: opening, duration: 0},
        {operation: 'pacing', scene_ref: opening, transition: 31}, {operation: 'reorder', scene_refs: [opening, opening]}])
        assert.throws(() => prepareNativeSceneEdit(view(), view().journey, intent));
      assert.equal(effects.length, count); assert.equal(hash(await inspect(ref)), prior);
    });
    await check('ref reorder preserves whole content, native selection and occurrence correspondence', async () => {
      const before = view(), material = new Map(before.document.scenes.map(scene => [scene.scene_ref, hash(scene.presentation)]));
      const identities = {...before.entity_ids};
      await apply({operation: 'reorder', scene_refs: [closing, opening]});
      assert.deepEqual(view().document.scenes.map(scene => scene.scene_ref), [closing, opening]);
      for (const scene of view().document.scenes) assert.equal(hash(scene.presentation), material.get(scene.scene_ref));
      assert.deepEqual(view().entity_ids, identities); assert.equal(view().document.selection.scene_ref, opening);
    });
    await check('Scene save, subsequent edit and restore retain Saved/Edited/Draft distinction', async () => {
      await snapshot({operation: 'save-snapshot', scene_ref: opening});
      const id = Object.entries(view().bindings).find(([, binding]) => binding.scene_ref === opening)[0];
      assert.equal(sceneSaveState(view().journey, view().journey.scenes.find(scene => scene.id === id)), 'Saved');
      const saved = hash(view().document.scenes.find(scene => scene.scene_ref === opening).presentation.saved);
      await apply({operation: 'pacing', scene_ref: opening, duration: 17});
      assert.equal(sceneSaveState(view().journey, view().journey.scenes.find(scene => scene.id === id)), 'Edited since save');
      assert.equal(hash(view().document.scenes.find(scene => scene.scene_ref === opening).presentation.saved), saved);
      await snapshot({operation: 'restore-snapshot', scene_ref: opening});
      assert.equal(view().document.scenes.find(scene => scene.scene_ref === opening).presentation.scene.duration, 9.25);
      assert.equal(sceneSaveState(view().journey, view().journey.scenes.find(scene => scene.id === id)), 'Saved');
    });
    await check('duplicate is a new native draft Scene over the same exact native objects', async () => {
      const source = view().document.scenes.find(scene => scene.scene_ref === opening);
      const plan = await apply({operation: 'duplicate', scene_ref: opening, title: 'Opening variation'});
      duplicate = plan.created_scene_ref; assert.ok(duplicate && duplicate !== opening);
      const actual = view().document.scenes.find(scene => scene.scene_ref === duplicate);
      assert.deepEqual(actual.entity_refs, source.entity_refs);
      // expression_scene::Presentation omits saved when Option::None; an
      // absent native saved field is the owner's draft form, not JSON null.
      assert.equal(actual.presentation.saved, undefined);
      const id = Object.entries(view().bindings).find(([, binding]) => binding.scene_ref === duplicate)[0];
      assert.equal(sceneSaveState(view().journey, view().journey.scenes.find(scene => scene.id === id)), 'Draft');
      assert.equal(hash(view().document.entities), objects); assert.equal(view().document.selection.scene_ref, duplicate);
      assert.equal(plan.request.changes.filter(change => change.change === 'scene_create').length, 1);
      assert.equal(plan.request.changes.some(change => change.change === 'entity_add'), false);
    });
    await check('receiver: exact cross-Scene object focus awaits native ACK; wrong Scene membership writes nothing; Scene play routes null-focus/seek/play callbacks', async () => {
      assert.ok(duplicate && duplicate !== opening);
      const initial = await inspect(ref), localBefore = hash(store.document), occurrence = initial.scenes.find(scene => scene.scene_ref === opening).entity_refs[0];
      observations.length = 0;
      let reading = owner.read();
      await owner.scene({operation: 'scene', basis: reading.basis, intent_epoch: reading.playback.intent_epoch,
        action: 'focus-object', scene_ref: opening, entity_ref: occurrence});
      const focused = await inspect(ref);
      assert.deepEqual(focused.selection, {entity_ref: occurrence, scene_ref: opening});
      assert.deepEqual(owner.read().nativeSelection, focused.selection);
      assert.equal(view().bindings[currentId].scene_ref, opening);
      assert.deepEqual(observations.map(row => row.event), ['native-focus-ack', 'local-scene', 'local-occurrence']);
      for (const row of observations) {assert.equal(row.native_revision, focused.revision); assert.deepEqual(row.native_selection, focused.selection)}
      reading = owner.read(); const count = effects.length, callbacks = observations.length;
      await assert.rejects(() => owner.scene({operation: 'scene', basis: reading.basis, intent_epoch: reading.playback.intent_epoch,
        action: 'focus-object', scene_ref: closing, entity_ref: occurrence}), /not loaded in this exact Scene/);
      assert.equal(effects.length, count); assert.equal(observations.length, callbacks); assert.deepEqual(await inspect(ref), focused);
      reading = owner.read();
      await owner.scene({operation: 'scene', basis: reading.basis, intent_epoch: reading.playback.intent_epoch,
        action: 'play-scene', scene_ref: duplicate});
      const played = await inspect(ref);
      assert.deepEqual(played.selection, {entity_ref: null, scene_ref: duplicate});
      assert.deepEqual(observations.slice(callbacks).map(row => row.event), ['native-focus-ack', 'local-scene', 'seek-callback', 'transport-callback']);
      for (const row of observations.slice(callbacks)) {assert.equal(row.native_revision, played.revision); assert.deepEqual(row.native_selection, played.selection)}
      assert.equal(hash(store.document), localBefore); assert.equal(hash(played.entities), hash(initial.entities));
      assert.deepEqual(played.scenes, initial.scenes); assert.equal(played.revision, initial.revision + 2);
      evidence.receiver = {initial_revision: initial.revision, final_revision: played.revision, observations,
        wrong_membership_native_writes: 0, transport_coverage: 'Real native focus acknowledgements and receiver callbacks only; no renderer, clock advancement, engine or playback acceptance'};
    });
    await check('labelled actual-view fault: unloaded whole and external-carrier duplication remain explicit refusals', async () => {
      const before = hash(view());
      const partial = clone(view()), id = Object.entries(partial.bindings).find(([, binding]) => binding.scene_ref === opening)[0];
      partial.bindings[id].page_count = 2;
      assert.throws(() => prepareNativeSceneEdit(partial, partial.journey, {operation: 'duplicate', scene_ref: opening}), /whole native Scene/);
      const unknown = clone(view()); unknown.document.scenes.find(scene => scene.scene_ref === opening).unsupportedOwnerCarrier = true;
      assert.throws(() => prepareNativeSceneEdit(unknown, unknown.journey, {operation: 'duplicate', scene_ref: opening}), /unsupported native Scene fields/);
      assert.equal(hash(view()), before);
    });
    await check('labelled actual-view faults: absent authored material, relation focus and unacknowledged snapshot focus refuse', async () => {
      const absent = clone(view()); delete absent.document.scenes.find(scene => scene.scene_ref === opening).presentation;
      for (const intent of [{operation: 'rename', scene_ref: opening, title: 'No synthetic material'},
        {operation: 'pacing', scene_ref: opening, duration: 8}, {operation: 'duplicate', scene_ref: opening}])
        assert.throws(() => prepareNativeSceneEdit(absent, absent.journey, intent), /authored native Scene material/);
      const relation = clone(view()); relation.document.selection.relation_ref = 'fault-injection:unloaded-relation';
      assert.throws(() => prepareNativeSceneEdit(relation, relation.journey, {operation: 'reorder', scene_refs: relation.document.scenes.map(scene => scene.scene_ref)}), /relation-only focus/);
      const focus = clone(owner.read()); focus.scenes.native_selected_scene_ref = closing;
      assert.throws(() => prepareNativeSceneSnapshot(focus, {operation: 'save-snapshot', scene_ref: duplicate}), /not acknowledged/);
    });
    await check('review fault: withheld local Scene cannot imply native deletion; zero native write', async () => {
      const retained = view(), withheld = clone(retained.journey);
      withheld.scenes = withheld.scenes.filter(scene => retained.bindings[scene.id].scene_ref !== closing);
      const before = hash(await inspect(ref)), count = effects.length;
      assert.throws(() => prepareNativeSceneEdit(retained, withheld, {operation: 'rename', scene_ref: opening, title: 'No implicit deletion'}), /complete captured native Scene inventory/);
      assert.equal(effects.length, count); assert.equal(hash(await inspect(ref)), before);
      evidence.review_fault = {source: 'prepareCompositionEdit deletes every native Scene absent from supplied Journey',
        actual_native_basis_revision: retained.document.revision, withheld_local_scene_ref: closing, native_writes: 0,
        repair: 'Require projectNativeScenes(...).completeness.order before every composition preparation'};
    });
    await check('real revision conflict refuses the captured request and preserves the newer native work', async () => {
      const stale = prepareNativeSceneEdit(view(), view().journey, {operation: 'rename', scene_ref: opening, title: 'Stale title must not land'});
      await apply({operation: 'rename', scene_ref: closing, title: 'Closing acknowledged'});
      const before = hash(await inspect(ref)), conflict = await operation('expression', stale.request);
      assert.equal(conflict.state, 'revision_conflict'); assert.throws(() => acceptCompositionReply(stale.request, conflict), /revision_conflict/);
      assert.equal(hash(await inspect(ref)), before);
    });
    await check('removal preserves native object register and protects the last Scene', async () => {
      await apply({operation: 'remove', scene_ref: duplicate});
      assert.equal(view().document.scenes.some(scene => scene.scene_ref === duplicate), false);
      await apply({operation: 'remove', scene_ref: closing});
      const before = hash(await inspect(ref)), count = effects.length;
      assert.throws(() => prepareNativeSceneEdit(view(), view().journey, {operation: 'remove', scene_ref: opening}), /at least one Scene/);
      assert.equal(effects.length, count); assert.equal(hash(await inspect(ref)), before);
      assert.equal(hash(view().document.entities), objects); assert.equal(hash(view().document.relations ?? {}), relations);
    });
    const joined = () => {
      const local = new DocumentStore(view().journey), presented = {id: view().startSceneId, epoch: 0, lifetime: 0};
      const success = [];
      const handler = createNativeSceneEditHandler({store: local, sceneId: () => presented.id,
        intentEpoch: () => presented.epoch, lifetime: () => presented.lifetime,
        afterSuccess: input => {
          assert.deepEqual(input.view.document, view().document, 'The presentation hook receives an actually acknowledged native document');
          assert.deepEqual(local.document, view().journey, 'Store acknowledgement precedes the presentation hook');
          success.push({label: input.label, revision: input.view.document.revision, scene_id: input.scene_id,
            native_scene_ref: input.view.bindings[input.scene_id].scene_ref, selection_changed: input.selection_changed});
          presented.id = input.scene_id; presented.epoch++;
        }});
      const request = intent => ({operation: 'scene-edit', ...handler.read(working), intent});
      const receiver = () => {const lifetime = presented.lifetime; return {working, isCurrent: () => lifetime === presented.lifetime}};
      return {local, presented, success, handler, request, receiver};
    };
    await check('joined handler: five structural edits each make one store gesture, one native revision and only acknowledged presentation', async () => {
      const h = joined(); let newRef;
      for (const intent of [
        {operation: 'rename', scene_ref: opening, title: 'Joined opening'},
        {operation: 'pacing', scene_ref: opening, duration: 11, transition: 1.25},
        {operation: 'duplicate', scene_ref: opening, title: 'Joined variation'},
        null, null,
      ]) {
        const actual = intent ?? (!newRef ? undefined : h.success.length === 3
          ? {operation: 'reorder', scene_refs: [newRef, opening]} : {operation: 'remove', scene_ref: newRef});
        assert.ok(actual);
        const revision = view().document.revision, undo = h.local.undoStack.length, version = h.local.revision,
          presentedId = h.presented.id, callbacks = h.success.length;
        beforeEdit = async () => {
          assert.equal(h.local.undoStack.length, undo + 1); assert.equal(h.local.revision, version + 1);
          assert.equal(h.presented.id, presentedId); assert.equal(h.success.length, callbacks);
          assert.deepEqual(working.state.pending.submitted.journey, h.local.document,
            'NativeWorking retained the actual post-gesture document including updatedAt');
        };
        const result = await h.handler.edit(h.request(actual), h.receiver());
        assert.equal(result.state, 'applied'); assert.equal(result.local_adoption, 'adopted');
        assert.equal(view().document.revision, revision + 1); assert.deepEqual(result.native_outcome, await inspect(ref));
        assert.equal(h.local.undoStack.length, undo + 1); assert.equal(h.local.revision, version + 2);
        assert.equal(h.success.length, callbacks + 1); assert.equal(hash(view().document.entities), objects);
        if (actual.operation === 'duplicate') newRef = view().document.selection.scene_ref;
      }
      const count = effects.length, undo = h.local.undoStack.length, callbacks = h.success.length;
      const sameName = view().document.scenes.find(scene => scene.scene_ref === opening).title;
      const unchanged = await h.handler.edit(h.request({operation: 'rename', scene_ref: opening, title: sameName}), h.receiver());
      assert.equal(unchanged.state, 'unchanged'); assert.equal(effects.length, count);
      assert.equal(h.local.undoStack.length, undo); assert.equal(h.success.length, callbacks);
      evidence.joined_success = {callbacks: h.success, undo_entries: undo, unchanged_writes: 0};
    });
    await check('joined handler: stale native selection, authored revision, intent and receiver refuse before a store gesture/native write', async () => {
      for (const fault of ['selection', 'authored', 'intent', 'lifetime', 'open-gesture']) {
        const h = joined(), request = h.request({operation: 'rename', scene_ref: opening, title: 'Stale receiver must not write'});
        const receiver = h.receiver();
        if (fault === 'selection') request.native_selection.scene_ref = closing;
        if (fault === 'authored') h.local.change(document => {document.scenes[0].name = 'New local authored name'});
        if (fault === 'intent') h.presented.epoch++;
        if (fault === 'lifetime') h.presented.lifetime++;
        if (fault === 'open-gesture') h.local.begin();
        const before = hash(h.local.document), undo = h.local.undoStack.length, revision = h.local.revision, count = effects.length;
        await assert.rejects(() => h.handler.edit(request, receiver), /captured native Scene|current gesture/);
        assert.equal(hash(h.local.document), before); assert.equal(h.local.undoStack.length, undo);
        assert.equal(h.local.revision, revision); assert.equal(effects.length, count); assert.equal(h.success.length, 0);
      }
    });
    await check('joined handler: real competing revision refuses commit and retains original failure draft/checkpoint without presentation', async () => {
      const h = joined(), request = h.request({operation: 'rename', scene_ref: opening, title: 'Joined conflict draft retained'});
      beforeEdit = async submitted => {
        const newer = await operation('expression', {operation: 'edit', expression_ref: ref, expected_revision: submitted.expected_revision,
          actor: 'agent:scene-core-competing-revision', changes: [{change: 'scene_rename', scene_ref: opening, title: 'Newer native Scene title'}]});
        assert.equal(newer.state, 'ready');
      };
      const before = view().document.revision;
      await assert.rejects(() => h.handler.edit(request, h.receiver()), /revision_conflict/);
      const document = await inspect(ref), record = working.state;
      assert.equal(document.revision, before + 1); assert.equal(document.scenes[0].title, 'Newer native Scene title');
      assert.equal(h.local.document.scenes[0].name, 'Joined conflict draft retained');
      assert.equal(h.local.undoStack.length, 1); assert.equal(h.success.length, 0); assert.equal(record.pending.kind, 'edit');
      assert.deepEqual(record.pending.submitted.journey, h.local.document);
      const checkpoint = await operation('expression_recovery', {operation: 'read', scope: 'expressions', kind: 'checkpoint', id: record.draft_id});
      assert.deepEqual(checkpoint.record.value, record);
      evidence.joined_conflict = {native_document: document, retained_local_draft: clone(h.local.document),
        retained_native_checkpoint: checkpoint, presentation_callbacks: 0,
        continuation: 'The acceptance harness explicitly reads/adopts this native work for subsequent cases; handler never retries or reconciles implicitly'};
      await working.adopt(document);
    });
    await check('joined handler: actual native ACK survives newer local work, transport intent and departed lifetime without adoption/body update', async () => {
      const cases = [];
      for (const fault of ['new-local-work', 'transport-intent', 'departed-lifetime']) {
        const h = joined(), request = h.request({operation: 'rename', scene_ref: opening, title: `Native ACK retained / ${fault}`});
        const receiver = h.receiver(); let retained;
        beforeEdit = async () => {
          if (fault === 'new-local-work') h.local.change(document => {document.scenes[0].transition = 2.75});
          if (fault === 'transport-intent') h.presented.epoch++;
          if (fault === 'departed-lifetime') {h.presented.lifetime++; working.detach();}
          retained = clone(h.local.document);
        };
        const result = await h.handler.edit(request, receiver), document = await inspect(ref);
        assert.equal(result.state, 'native-acknowledged'); assert.equal(result.local_adoption, 'refused');
        assert.deepEqual(result.native_outcome, document); assert.deepEqual(h.local.document, retained);
        assert.equal(h.success.length, 0); assert.equal(h.presented.id, request.basis.scene_ref === opening
          ? Object.entries(kernelDocumentToJourney(document).bindings).find(([, binding]) => binding.scene_ref === opening)[0] : h.presented.id);
        cases.push({fault, result, retained_local_draft: retained, presentation_callbacks: 0});
        // Explicitly reopen only this acceptance work. In the departed case,
        // NativeWorking already retained the ACK in its real checkpoint.
        await working.adopt(document);
      }
      evidence.joined_late_ack = cases;
    });
    await check('owning file save, independent byte readback, close and reopen retain the actual composition', async () => {
      const current = view(), snapshot = {journey: current.journey, sceneId: current.startSceneId, entityId: null};
      const saved = await working.saveFile(snapshot, {parent_path: directory, name: 'scene-core.oi-expression.json'});
      const document = await inspect(ref), file = await readFile(transport, saved.location);
      assert.equal(file.revision, saved.revision); assert.deepEqual(JSON.parse(file.content), document);
      const closed = await operation('expression', {operation: 'close', expression_ref: ref, actor: 'agent:scene-core-acceptance'});
      assert.equal(closed.state, 'closed');
      const opened = await hostedCompositionFile(transport, {operation: 'open', path: saved.location.path});
      assert.deepEqual(opened.document, document); assert.equal(opened.file.revision, saved.revision);
      const restored = kernelDocumentToJourney(opened.document);
      assert.deepEqual(prepareCompositionEdit(restored, restored.journey).changes, []);
      assert.deepEqual(restored.document.scenes[0].entity_refs, document.scenes[0].entity_refs);
      evidence.artifact = {location: saved.location, revision: saved.revision, document_revision: document.revision, document_sha256: hash(document)};
    });
    for (const [protectedRef, before] of original) await check(`${protectedRef}: protected native document unchanged`, async () => {
      const after = await inspect(protectedRef); assert.equal(after.revision, before.revision); assert.equal(hash(after), hash(before));
      evidence.protected_documents.push({expression_ref: protectedRef, revision: after.revision, document_sha256: hash(after)});
    });
    evidence.passed = true; evidence.checkpoint_ids = [...recoveryIds];
    evidence.limitations = ['External Scene bodies/triggers/unsupported native fields need an atomic duplicate owner extension; current adapter refuses them',
      'Paged/hidden Scene membership cannot be duplicated or marked whole-saved here', 'Ref-addressed app/host routing and local-clock/body navigation remain root joins',
      'Absent authored material cannot supply rename/pacing/duplication; relation-only focus requires an acknowledged native Scene/occurrence focus first',
      'Kernel act undo/redo and rendered craft acceptance are not claimed'];
    await writeFile(`${path}/scene-edit-acceptance.json`, JSON.stringify(evidence, null, 2) + '\n', {flag: 'wx'});
    console.log(JSON.stringify({passed: true, checks: checks.length, expression_ref: ref, artifact: evidence.artifact,
      evidence: `${path}/scene-edit-acceptance.json`, effects: effects.length, checkpoint_ids: evidence.checkpoint_ids,
      source_sha256: Object.fromEntries(Object.entries(source_sha256).filter(([path]) => /\/(sceneEdits\.ts|scene-edits-native-acceptance\.mjs|run-native-scene-edits\.mjs)$/.test(path))),
      tested_import_source_count: Object.keys(source_sha256).length, limitations: evidence.limitations}, null, 2));
  } catch (error) {
    evidence.passed = false; evidence.error = error.message;
    await writeFile(`${path}/scene-edit-failure.json`, JSON.stringify(evidence, null, 2) + '\n', {flag: 'wx'});
    throw error;
  }
}
