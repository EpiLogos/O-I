/** O-I #747 round 892 (XT02–XT06): each cut is one labelled step that Undo takes back and Redo makes again, at the Expression's owner.
 * Walk 892 found the step labelled but empty: the frame's history refused it ("this edit recorded no kernel changes, so it cannot be
 * undone as a kernel edit"), because the scene edit committed through the working owner without recording the owner's checkpoint on its
 * step. Here the real handler, the real DocumentStore and the real NativeWorking run against an owner that keeps one Expression by the
 * kernel's edit rules for the kinds a cut emits; the history step then goes the way the frame takes it (app.ts historyStep): the step's
 * plan, the recorded documents, the owner's replay, the store's step. Nothing is stubbed but the owner's storage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeSceneEditHandler, ownerSelectedScene, prepareNativeSceneEdit} from '../src/sceneEdits.ts';
import {projectNativeScenes} from '../src/scenes.ts';
import {blankScene, clone} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts';
import {NativeWorking} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking.ts';

const E = 'expression:cut-history';
const S = n => `${E}:scene:s${n}`;
function base() {
  const scenes = [10, 8, 12, 6].map((duration, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  return {schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Cut history', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []};
}
/** The kernel's edit rules for the kinds a cut and its compensation emit. Anything else fails the test; it is never skipped. */
function applyChanges(doc, changes) {
  const d = clone(doc), at = ref => {const scene = d.scenes.find(s => s.scene_ref === ref); if (!scene) throw Error(`no scene ${ref}`); return scene};
  for (const c of changes) {
    switch (c.change) {
      case 'scene_create': if (d.scenes.some(s => s.scene_ref === c.scene_ref)) throw Error(`${c.scene_ref} exists`);
        d.scenes.push({scene_ref: c.scene_ref, revision: 1, title: c.title, entity_refs: []}); break;
      case 'scene_remove': at(c.scene_ref); d.scenes = d.scenes.filter(s => s.scene_ref !== c.scene_ref); break;
      case 'scene_reorder': {
        if (c.scene_refs.length !== d.scenes.length || !c.scene_refs.every(ref => d.scenes.some(s => s.scene_ref === ref))) throw Error('reorder names other scenes');
        d.scenes = c.scene_refs.map(at); break;
      }
      case 'scene_rename': at(c.scene_ref).title = c.title; break;
      case 'scene_compose': at(c.scene_ref).entity_refs = [...c.entity_refs]; break;
      case 'rename': d.title = c.title; break;
      case 'scene_material_set': at(c.scene_ref).presentation = clone(c.presentation); break;
      case 'scene_material_clear': delete at(c.scene_ref).presentation; break;
      case 'focus': d.selection = {scene_ref: c.scene_ref, entity_ref: c.entity_ref ?? null}; break;
      default: throw Error(`the test owner has no rule for ${c.change}`);
    }
  }
  return d;
}
function owner() {
  const state = {doc: base()};
  const ports = {mint: () => 'expression:unused', checkpoint: async () => {}, file: async () => {throw Error('No file owner in this test')},
    expression: async request => {
      if (request.operation === 'inspect') return {state: 'ready', document: clone(state.doc)};
      if (request.operation === 'edit') {
        if (request.expected_revision !== state.doc.revision) return {state: 'revision_conflict', current_revision: state.doc.revision, expression_ref: E};
        state.doc = applyChanges(state.doc, request.changes); state.doc.revision++;
        return {state: 'ready', document: clone(state.doc)};
      }
      throw Error(`unexpected owner operation ${request.operation}`);
    }};
  return {state, ports};
}
/** What the Expression holds, without the revision counters. */
const held = doc => {const content = clone(doc); delete content.revision; for (const scene of content.scenes) delete scene.revision; return JSON.stringify(content)};
const shape = journey => journey.scenes.map(scene => `${scene.id.slice(-2)}:${scene.duration}:${scene.entryOffset ?? 0}`).join(' ');

/** `known: false` opens the store as the walk found the frame's: its kernel depth unknown (no Save or acknowledgement recorded yet). */
async function opened({known = true} = {}) {
  const kernel = owner(), working = new NativeWorking(kernel.ports);
  const view = await working.adopt(clone(kernel.state.doc));
  const store = new DocumentStore(view.journey); if (known) store.markKernelSaved();
  const handler = createNativeSceneEditHandler({store, sceneId: () => store.document.scenes[0].id, intentEpoch: () => 1, lifetime: () => 'one', afterSuccess() {}});
  return {kernel, working, store, handler};
}
async function cut({working, handler}, intent) {
  const captured = handler.read(working);
  return handler.edit({operation: 'scene-edit', basis: captured.basis, native_selection: captured.native_selection, intent_epoch: 1, intent},
    {working, isCurrent: () => true});
}
/** One history step as the frame takes it (app.ts historyStep): a refused plan is said, a kernel plan is replayed by the owner first. */
async function step({working, store}, direction) {
  const plan = direction === 'undo' ? store.undoPlan() : store.redoPlan();
  if (!plan) return {refused: 'nothing'};
  if (plan.kernel && 'refused' in plan.kernel) return {refused: plan.kernel.reason};
  if (plan.kernel && plan.kernel.changes.length) {
    const expected = store.checkpointAt(direction), entry = direction === 'undo' ? store.undoStack.at(-1) : store.redoStack.at(-1);
    if (!expected) return {refused: 'its recorded native state is not held'};
    await working.replayKernelEdit(plan.kernel.changes, direction === 'undo' ? {from: expected.after, to: expected.before, journey: entry.snapshot}
      : {from: expected.before, to: expected.after, journey: entry.snapshot});
    return {stepped: direction === 'undo' ? store.undoAccepted() : store.redo({compensated: true}), label: plan.label};
  }
  return {stepped: direction === 'undo' ? store.undo() : store.redo(), label: plan.label, local: true};
}

/** Walk 892 (captures-9, 10-split-redone): after Redo of a Split the Arrangement drew the made scene with no length — the scenes reading
 * said of it "The working Scene is not loaded". The owner made the scene again under its own ref, and the frame's view bound that ref to a
 * new local id, not the one the restored document names it by. Here: every scene the owner holds is read whole from the frame — the
 * document's own scene, at the owner's length — and nothing in the document is left unbound. */
function whole({kernel, working, store}, at) {
  const reading = projectNativeScenes(store.document, working.state.view);
  const owned = kernel.state.doc.scenes.map(scene => `${scene.scene_ref.slice(-6)} ${scene.presentation?.scene?.duration}`);
  const read = reading.scenes.map(row => `${row.scene_ref.slice(-6)} ${row.working ? row.working.duration : `not read: ${row.material.reason}`}`);
  assert.deepEqual(read, owned, `${at}: the frame reads every scene the owner holds, at its length`);
  assert.deepEqual(reading.unbound_local_scene_ids, [], `${at}: no scene of the document is unbound`);
}

const CUTS = [
  ['move, insert', {operation: 'move', scene_ref: S(4), mode: 'insert', to_ref: S(2)}],
  ['move, overwrite', {operation: 'move', scene_ref: S(4), mode: 'overwrite', to_ref: S(2)}],
  ['trim', {operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 3}],
  ['roll', {operation: 'roll', scene_ref: S(1), seconds: 2}],
  ['slip', {operation: 'slip', scene_ref: S(3), seconds: -3}],
  ['slide', {operation: 'slide', scene_ref: S(2), seconds: 2}],
  ['split', {operation: 'split', scene_ref: S(3), at: 5}],
];

for (const [name, intent] of CUTS) {
  test(`#747 r892 ${name}: one labelled step; Undo takes it back at the owner and in the document, Redo makes it again, Undo again`, async () => {
    const own = await opened(), before = held(own.kernel.state.doc), beforeShape = shape(own.store.document);
    const label = prepareNativeSceneEdit(own.working.state.view, clone(own.store.document), intent).label;
    const result = await cut(own, intent);
    assert.equal(result.state, 'applied');
    const after = held(own.kernel.state.doc), afterShape = shape(own.store.document);
    assert.notEqual(after, before, 'the cut reached the owner');
    assert.equal(own.store.undoStack.length, 1, 'one step');
    assert.equal(own.store.undoLabel(), label, 'named for the gesture');

    const undone = await step(own, 'undo');
    assert.equal(undone.refused, undefined, `Undo ${label} is taken, not refused: ${undone.refused}`);
    assert.deepEqual([undone.stepped, undone.local], [true, undefined], 'through the owner, not locally only');
    assert.equal(held(own.kernel.state.doc), before, 'the owner holds the Expression as it was before the cut');
    assert.equal(shape(own.store.document), beforeShape, 'and so does the document');
    whole(own, 'undone');
    assert.equal(own.store.redoLabel(), label);

    const redone = await step(own, 'redo');
    assert.equal(redone.refused, undefined, `Redo ${label} is taken: ${redone.refused}`);
    assert.equal(held(own.kernel.state.doc), after, 'the owner holds the cut again');
    assert.equal(shape(own.store.document), afterShape);
    whole(own, 'redone');

    const again = await step(own, 'undo');
    assert.equal(again.refused, undefined, `Undo ${label} again: ${again.refused}`);
    assert.equal(held(own.kernel.state.doc), before);
    assert.equal(shape(own.store.document), beforeShape);
    whole(own, 'undone again');
  });
}

test('#747 r892 two cuts are two steps: Undo takes back the later, then the earlier, each at the owner', async () => {
  const own = await opened(), first = held(own.kernel.state.doc);
  await cut(own, {operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 3});
  const middle = held(own.kernel.state.doc);
  await cut(own, {operation: 'roll', scene_ref: S(1), seconds: 2});
  assert.deepEqual(own.store.undoStack.map(entry => entry.label), ['Trim Scene', 'Roll Scene seam']);
  assert.equal((await step(own, 'undo')).label, 'Roll Scene seam');
  assert.equal(held(own.kernel.state.doc), middle);
  assert.equal((await step(own, 'undo')).label, 'Trim Scene');
  assert.equal(held(own.kernel.state.doc), first);
});

test('#747 r892 a cut the owner holds is not taken back when the Expression moved after it: the owner refuses and nothing is written', async () => {
  const own = await opened();
  await cut(own, {operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 3});
  own.kernel.state.doc = applyChanges(own.kernel.state.doc, [{change: 'rename', title: 'Renamed elsewhere'}]); own.kernel.state.doc.revision++;
  const moved = held(own.kernel.state.doc);
  await assert.rejects(step(own, 'undo'), /document_moved/, 'refused in the owner\'s words');
  assert.equal(held(own.kernel.state.doc), moved, 'nothing was written');
  assert.equal(own.store.undoLabel(), 'Trim Scene', 'and the step stays');
});

// Walk 892 (captures-4): after Undo of a Move the frame presented another scene than the owner selects — it kept the presented index, which
// the restored order gives to another scene — so every later cut was refused ("The captured native Scene, selection, … changed before its
// edit") and the shell could not adopt the step's reading. The owner holds the selection (app.ts followNativeScene): after a step that
// crossed a recorded Save the frame presents the scene the owner selects (app.ts historyStep, read below).
test('#747 r892 after a step the owner answered, the scene to present is the one the owner selects, not the one at the presented index', async () => {
  const own = await opened();
  assert.equal(own.kernel.state.doc.selection.scene_ref, S(1));
  await cut(own, {operation: 'move', scene_ref: S(1), mode: 'insert', to_ref: null});
  const at = own.store.document.scenes.findIndex(scene => scene.id === S(1));
  assert.equal(at, 3, 'the moved scene stands last');
  await step(own, 'undo');
  assert.notEqual(own.store.document.scenes[at].id, S(1), 'the restored order gives that place to another scene');
  assert.equal(ownerSelectedScene(own.working.state.view, own.store.document), 0, 'the owner selects the scene where it stood before the cut');
  await step(own, 'redo');
  assert.equal(ownerSelectedScene(own.working.state.view, own.store.document), 3);
  const view = clone(own.working.state.view); view.document.selection = null;
  assert.equal(ownerSelectedScene(view, own.store.document), -1, 'no selection: nothing to follow');
});

test('#747 r892 CODE-READING: the frame presents the owner\'s selection after a step its owner answered, and tells the shell', async () => {
  const {readFile} = await import('node:fs/promises');
  const app = await readFile(new URL('../../../desktop/cradle/expressions-app/field-studies-journeys/src/app.ts', import.meta.url), 'utf8');
  assert.match(app, /stepped=direction==='undo'\?store\.undoAccepted\(\):store\.redo\(\{compensated:true\}\);\n\s*if\(stepped\)presentOwnerSelection\(\);/);
  assert.match(app, /nativeWorkspace\.replayCheckpoint\(kernel\.changes,direction==='undo'\?\{from:expected\.after,to:expected\.before,journey:entry\?\.snapshot\}:\{from:expected\.before,to:expected\.after,journey:entry\?\.snapshot\}\)/,
    'the owner\'s replay binds what it makes again to the document the step restores');
  assert.match(app, /function presentOwnerSelection\(\)\{\n[^\n]*\n const index=ownerSelectedScene\(view,store\.document\);\n if\(index>=0&&index!==sceneIndex\)\{sceneIndex=index;sceneIntentEpoch\+\+;[^\n]*\n announceHostState\(\);/);
});

// Walk 892 (captures-5): Undo took the cut back at the owner, but Redo was taken only in the frame ("Redone: Move Scene.") while the owner
// kept the Expression as Undo left it, and the next Undo was local too. The frame's store had no kernel depth recorded before the cut, so
// the cut's checkpoint began at an unknown depth and Undo returned the store to it. A cut on a document the owner holds whole (nothing
// unsaved) begins where the owner stands: Redo and Undo then each reach the owner.
test('#747 r892 a cut on a document the owner holds whole begins where the owner stands, so Redo and Undo reach it even with no depth recorded before', async () => {
  for (const [name, intent] of CUTS) {
    const own = await opened({known: false}), before = held(own.kernel.state.doc);
    await cut(own, intent);
    const after = held(own.kernel.state.doc);
    await step(own, 'undo');
    assert.equal(held(own.kernel.state.doc), before, `${name}: Undo at the owner`);
    const redone = await step(own, 'redo');
    assert.equal(redone.local, undefined, `${name}: Redo is the owner's, not the frame's alone`);
    assert.equal(held(own.kernel.state.doc), after, `${name}: the owner holds the cut again`);
    const again = await step(own, 'undo');
    assert.equal(again.local, undefined, `${name}: and Undo again`);
    assert.equal(held(own.kernel.state.doc), before);
  }
});

test('#747 r892 with work the owner does not hold, the cut claims nothing about it: after Undo of the cut, that work is undone in the frame', async () => {
  const own = await opened({known: false});
  own.store.change('Rename Expression', () => {own.store.document.name = 'Renamed here'});
  const before = held(own.kernel.state.doc);
  await cut(own, {operation: 'trim', scene_ref: S(2), edge: 'end', seconds: 3});
  assert.equal(JSON.parse(held(own.kernel.state.doc)).title, 'Renamed here', 'the cut\'s commit carried the unsaved rename with it');
  const undone = await step(own, 'undo');
  assert.deepEqual([undone.label, undone.local], ['Trim Scene', undefined]);
  assert.equal(held(own.kernel.state.doc), before, 'the owner returns to what it held before the cut');
  assert.equal(own.store.document.name, 'Renamed here', 'the document keeps the rename the step below the cut made');
  const rename = await step(own, 'undo');
  assert.deepEqual([rename.label, rename.local, rename.refused], ['Rename Expression', true, undefined], 'the rename the owner never held alone is undone here');
});
