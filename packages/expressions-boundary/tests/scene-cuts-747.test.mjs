/** O-I #747 (manual §20.1 "Takes and Arrangement lanes": "Arrangement view is Expressions' timeline, and you cut on it as a video editor
 * does: move, trim, roll, slip, slide and split scenes (§16.6)"). Each cut is one named scene edit of the Expression's owner: the existing
 * Journey operation (sceneWorkflow.ts) on the captured native Scenes, prepared as one composition edit on the captured revision, labelled
 * for the undo list. Real authoring model, real composition owner; nothing is stubbed but the native acknowledgement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSceneEditHandler, prepareNativeSceneEdit} from '../src/sceneEdits.ts';
import {blankScene, clone} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts';

const E = 'expression:cuts';
const S = n => `${E}:scene:s${n}`;
/** Four native Scenes of 10, 8, 12 and 6 s, each with its authored material, the first selected. */
function seed({locked = null} = {}) {
  const scenes = [10, 8, 12, 6].map((duration, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    if (locked === i + 1) scene.clip = {locked: true};
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Cuts', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
const plan = (intent, view = seed()) => prepareNativeSceneEdit(view, clone(view.journey), intent);
const order = p => p.snapshot.journey.scenes.map(scene => scene.id);
const lengths = p => p.snapshot.journey.scenes.map(scene => scene.duration);
const sum = p => lengths(p).reduce((a, b) => a + b, 0);
const kinds = p => p.request.changes.map(change => change.change).filter(kind => kind !== 'focus');
const materialOn = p => p.request.changes.filter(change => change.change === 'scene_material_set').map(change => change.scene_ref).sort();

test('#747 move, insert: the scene moves before the scene it is dropped on and the rest shift; one scene_reorder, Σ unchanged', () => {
  const p = plan({operation: 'move', scene_ref: S(4), mode: 'insert', to_ref: S(2)});
  assert.equal(p.label, 'Move Scene');
  assert.deepEqual(order(p), [S(1), S(4), S(2), S(3)]);
  assert.equal(sum(p), 36, 'a move changes only where scenes stand');
  assert.deepEqual(kinds(p), ['scene_reorder']);
  assert.equal(p.basis.revision, 4, 'on the captured revision');
  assert.deepEqual(order(plan({operation: 'move', scene_ref: S(1), mode: 'insert', to_ref: null})), [S(2), S(3), S(4), S(1)], 'to the end');
  assert.deepEqual(plan({operation: 'move', scene_ref: S(2), mode: 'insert', to_ref: S(3)}).request.changes.filter(c => c.change !== 'focus'), [], 'where it stands: nothing changes');
});

test('#747 move, overwrite: the scene takes the place of the one it lands on, which leaves; its old place closes', () => {
  const p = plan({operation: 'move', scene_ref: S(4), mode: 'overwrite', to_ref: S(2)});
  assert.equal(p.label, 'Move Scene');
  assert.deepEqual(order(p), [S(1), S(4), S(3)]);
  assert.equal(sum(p), 28, 'the replaced scene gives back its length');
  assert.ok(kinds(p).includes('scene_remove'), 'the replaced scene leaves the Expression natively');
  assert.throws(() => plan({operation: 'move', scene_ref: S(2), mode: 'overwrite', to_ref: S(2)}), /cannot overwrite itself/);
  assert.throws(() => plan({operation: 'move', scene_ref: S(2), mode: 'overwrite', to_ref: null}), /Drop the scene on the scene it replaces/);
});

test('#747 trim: the end edge changes the length; the start edge changes it from the start and moves where the scene enters its content', () => {
  const end = plan({operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 3});
  assert.equal(end.label, 'Trim Scene');
  assert.deepEqual(lengths(end), [10, 11, 12, 6]);
  assert.deepEqual(materialOn(end), [S(2)], 'one material set, on that scene');
  const start = plan({operation: 'trim', scene_ref: S(3), edge: 'start', seconds: 2});
  assert.deepEqual(lengths(start), [10, 8, 10, 6]);
  assert.equal(start.snapshot.journey.scenes[2].entryOffset, 2, 'the scene enters its content 2 s later, so its end stays where it was in it');
  const back = plan({operation: 'trim', scene_ref: S(3), edge: 'start', seconds: -1}, (() => {
    const view = seed(); view.journey.scenes[2].entryOffset = 3; return view })());
  assert.equal(back.snapshot.journey.scenes[2].duration, 13); assert.equal(back.snapshot.journey.scenes[2].entryOffset, 2);
  assert.throws(() => plan({operation: 'trim', scene_ref: S(4), edge: 'end', seconds: -5.5}), /A scene lasts 1–3600 seconds/);
  assert.throws(() => plan({operation: 'trim', scene_ref: S(2), edge: 'start', seconds: -1}), /before the start of its own content/);
  assert.throws(() => plan({operation: 'trim', scene_ref: S(2), edge: 'start', seconds: 4}), /past its own end/);
});

test('#747 roll: the seam after the scene moves; one grows by what the other loses, and the roll stops at the limit it reaches', () => {
  const p = plan({operation: 'roll', scene_ref: S(1), seconds: 2});
  assert.equal(p.label, 'Roll Scene seam');
  assert.deepEqual(lengths(p), [12, 6, 12, 6]);
  assert.equal(sum(p), 36);
  assert.deepEqual(materialOn(p), [S(1), S(2)], 'exactly its two scenes');
  assert.deepEqual(lengths(plan({operation: 'roll', scene_ref: S(1), seconds: 20})), [17, 1, 12, 6], 'stopped where the next scene keeps 1 s');
  assert.throws(() => plan({operation: 'roll', scene_ref: S(4), seconds: 1}), /no scene after this one/);
});

test('#747 slip: the scene starts somewhere else inside its own content; its length and place stay', () => {
  const p = plan({operation: 'slip', scene_ref: S(3), seconds: -3});
  assert.equal(p.label, 'Slip Scene');
  assert.equal(p.snapshot.journey.scenes[2].entryOffset, 3, 'dragged 3 s earlier, the content enters 3 s later');
  assert.deepEqual(lengths(p), [10, 8, 12, 6]);
  assert.deepEqual(materialOn(p), [S(3)]);
  assert.throws(() => plan({operation: 'slip', scene_ref: S(3), seconds: 1}), /only start inside its own length/);
  assert.throws(() => plan({operation: 'slip', scene_ref: S(3), seconds: -12}), /only start inside its own length/);
});

test('#747 slide: the scene moves between fixed neighbours; the one before grows by what the one after loses, its own length stays', () => {
  const p = plan({operation: 'slide', scene_ref: S(2), seconds: 2});
  assert.equal(p.label, 'Slide Scene');
  assert.deepEqual(lengths(p), [12, 8, 10, 6]);
  assert.equal(sum(p), 36);
  assert.deepEqual(materialOn(p), [S(1), S(3)], 'only its neighbours change');
  assert.deepEqual(lengths(plan({operation: 'slide', scene_ref: S(2), seconds: -20})), [1, 8, 21, 6], 'it stops where the one before keeps 1 s');
  assert.throws(() => plan({operation: 'slide', scene_ref: S(1), seconds: 1}), /slides between two scenes/);
  assert.throws(() => plan({operation: 'slide', scene_ref: S(4), seconds: 1}), /slides between two scenes/);
});

test('#747 split: the scene is cut in two at a second of it; the lengths add up to the original, and the new scene is created natively', () => {
  const p = plan({operation: 'split', scene_ref: S(3), at: 5});
  assert.equal(p.label, 'Split Scene');
  assert.equal(p.snapshot.journey.scenes.length, 5);
  assert.deepEqual(lengths(p), [10, 8, 5, 7, 6]);
  assert.equal(p.snapshot.journey.scenes[3].name, 'Scene 3 / split');
  const create = p.request.changes.find(change => change.change === 'scene_create');
  assert.ok(create, 'one scene_create');
  assert.equal(p.created_scene_ref, create.scene_ref);
  assert.ok(p.affected_scene_refs.includes(S(3)) && p.affected_scene_refs.includes(create.scene_ref));
  assert.throws(() => plan({operation: 'split', scene_ref: S(3), at: 0.5}), /Too close to an edge/);
});

test('#747 a locked scene refuses a cut that changes it, in its words; a move that changes no scene is taken', () => {
  for (const intent of [{operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 1}, {operation: 'roll', scene_ref: S(1), seconds: 1},
    {operation: 'slip', scene_ref: S(2), seconds: -1}, {operation: 'slide', scene_ref: S(3), seconds: 1}, {operation: 'split', scene_ref: S(2), at: 4},
    {operation: 'move', scene_ref: S(4), mode: 'overwrite', to_ref: S(2)}])
    assert.throws(() => plan(intent, seed({locked: 2})), /This Scene is locked: unlock it to change it/, intent.operation);
  assert.deepEqual(order(plan({operation: 'move', scene_ref: S(2), mode: 'insert', to_ref: null}, seed({locked: 2}))), [S(1), S(3), S(4), S(2)]);
});

/** The owner's handler with its real store, and a working owner that answers the commit (the native acknowledgement is the one stub). */
function owner(view) {
  const store = new DocumentStore(clone(view.journey));
  const working = {busy: false, state: {view, pending: false}, commit: async () => ({...clone(view.document), revision: view.document.revision + 1})};
  const handler = createNativeSceneEditHandler({store, sceneId: () => store.document.scenes[0].id, intentEpoch: () => 1, lifetime: () => 'one', afterSuccess() {}});
  return {store, working, handler};
}
const request = (handler, working, intent, basis = {}) => {
  const captured = handler.read(working);
  return {operation: 'scene-edit', basis: {...captured.basis, ...basis}, native_selection: captured.native_selection, intent_epoch: 1, intent};
};

test('#747 each cut is one labelled step in the undo list, and a stale revision is refused in the owner\'s words', async () => {
  const view = seed(), {store, working, handler} = owner(view);
  await assert.rejects(handler.edit(request(handler, working, {operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 1}, {revision: 3}), {working, isCurrent: () => true}),
    /changed before its edit/, 'a gesture captured on an older revision is refused before anything is written');
  assert.equal(store.undoLabel(), null, 'and nothing is in the undo list');
  await assert.rejects(handler.edit(request(handler, working, {operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 1, extra: 1}), {working, isCurrent: () => true}),
    /operands/, 'a cut carries exactly its own operands');
  for (const [intent, label] of [[{operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 1}, 'Trim Scene'], [{operation: 'split', scene_ref: S(3), at: 5}, 'Split Scene']]) {
    const {store: own, working: w, handler: h} = owner(seed());
    await h.edit(request(h, w, intent), {working: w, isCurrent: () => true});
    assert.equal(own.undoLabel(), label, `${intent.operation}: one step, named`);
  }
});
