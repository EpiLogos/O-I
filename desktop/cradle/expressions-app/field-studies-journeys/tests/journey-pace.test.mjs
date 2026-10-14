// lane-5 T3 + T9: the journey's pace draft. The pace is a LOCAL draft carried by the presence entry, with its basis (the reading and the
// Expression revision). Only a save reaches the Expression: each changed beat is retimed as one labelled step through the owner's Save
// path. A draft whose basis moved is named stale and is never applied. Reorder still routes at once. Run after `npm run build:journeys`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  setPace, newPaceDraft, planPaceCommit, paceViewOf, sequenceOfDraft, draftForPresence, savedDuration, roundPace,
} from '../build/journeyPace.js';
import {
  reconcileJourneyPresence, recordJourneyPosition, paceDraftOf, savePaceDraft, FIELD_ADVANCED_NOTICE,
} from '../build/journeyPresence.js';

const KEY = 'oi-cradle.techne-journey.presence.v1';
const EXPRESSION = 'oi.expression:probe';
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;
const GHOST = `${EXPRESSION}:scene:ghost`;

function reading(overrides = {}) {
  return {
    contract: 'ql.techne/v1',
    reading_ref: 'ql.techne:reading:probe',
    snapshot: {revision: 'rev-1', basis_ref: null},
    subject: {subject_ref: EXPRESSION, native_owner: 'oi.cradle.kernel', kind: 'expression-scene'},
    ...overrides,
  };
}

function memoryStorage(seed) {
  const map = new Map(seed === undefined ? [] : [[KEY, seed]]);
  return {map, getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value))};
}

function savedEntry(storage) {
  return JSON.parse(storage.map.get(KEY) ?? 'null')?.[EXPRESSION];
}

// A native view: two scenes, each with its own authored material (the Scene's own duration lives in it), bound by journey scene id.
function view({oneDuration = 12, twoDuration = 14} = {}) {
  const material = (id, duration) => ({schema: 'oi.journey-scene/v1', scene: {id, name: id, duration, transition: 1.5}, saved: null});
  return {
    document: {
      expression_ref: EXPRESSION,
      revision: 7,
      scenes: [
        {scene_ref: ONE, title: 'One', presentation: material('sceneOne', oneDuration)},
        {scene_ref: TWO, title: 'Two', presentation: material('sceneTwo', twoDuration)},
      ],
    },
    bindings: {sceneOne: {scene_ref: ONE}, sceneTwo: {scene_ref: TWO}},
  };
}

function draftOf(pace, overrides = {}) {
  return {expression_ref: EXPRESSION, revision: '7', scene_order: [ONE, TWO], pace, ...overrides};
}

// ---- T3: the local draft

test('T3: a pace is a range-checked local draft, rounded to a tenth of a second, and the draft it came from is untouched', () => {
  const base = newPaceDraft(EXPRESSION, '7', [ONE, TWO]);
  const paced = setPace(base, ONE, 8.04);
  assert.equal(paced.ok, true);
  assert.deepEqual(paced.draft.pace, [{scene_ref: ONE, dwell_seconds: 8}]);
  assert.deepEqual(base.pace, [], 'the draft it was set from is not mutated');
  assert.equal(roundPace(2.25), 2.3);
});

test('T3: a pace outside the Scene duration bounds, or for a beat the draft does not hold, is refused by name', () => {
  const base = newPaceDraft(EXPRESSION, '7', [ONE, TWO]);
  for (const bad of [0.5, 0, -3, 3601, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = setPace(base, ONE, bad);
    assert.equal(result.ok, false, `a pace of ${bad} is refused`);
    assert.match(result.reason, /holds for 1–3600 seconds/);
  }
  const ghost = setPace(base, GHOST, 5);
  assert.equal(ghost.ok, false);
  assert.match(ghost.reason, /not in the draft/);
});

test('T3: setting a beat again replaces its pace; the other beats keep theirs', () => {
  let draft = newPaceDraft(EXPRESSION, '7', [ONE, TWO]);
  draft = setPace(draft, ONE, 6).draft;
  draft = setPace(draft, TWO, 9).draft;
  draft = setPace(draft, ONE, 4).draft;
  assert.deepEqual(draft.pace.sort((a, b) => a.scene_ref.localeCompare(b.scene_ref)), [
    {scene_ref: ONE, dwell_seconds: 4},
    {scene_ref: TWO, dwell_seconds: 9},
  ]);
});

// ---- T3: the commit is one labelled step over the beats whose duration changes

test('T3: a commit retimes only the beats whose own duration changes, named by their journey scene id, as one labelled step', () => {
  const draft = draftOf([{scene_ref: ONE, dwell_seconds: 8}, {scene_ref: TWO, dwell_seconds: 14}]);
  const plan = planPaceCommit(view(), draft);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.edits, [{sceneId: 'sceneOne', sceneRef: ONE, from: 12, seconds: 8}], 'TWO already holds 14 seconds and is not retimed');
  assert.equal(plan.label, 'Set beat pace · 1 beat');
});

test('T3: a draft that changes no duration plans no edit, so the commit writes nothing', () => {
  const plan = planPaceCommit(view(), draftOf([{scene_ref: ONE, dwell_seconds: 12}]));
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.edits, []);
  assert.equal(plan.label, 'Set beat pace');
});

test('T3: a beat with no native binding, or no authored material, is refused by name and nothing is planned', () => {
  const unbound = planPaceCommit({...view(), bindings: {sceneOne: {scene_ref: ONE}}}, draftOf([{scene_ref: TWO, dwell_seconds: 9}]));
  assert.equal(unbound.ok, false);
  assert.match(unbound.reason, /no native binding/);
  const bare = view();
  bare.document.scenes[0].presentation = null;
  const unmaterial = planPaceCommit(bare, draftOf([{scene_ref: ONE, dwell_seconds: 9}]));
  assert.equal(unmaterial.ok, false);
  assert.match(unmaterial.reason, /no authored native material/);
  assert.equal(savedDuration(view(), ONE), 12, 'the Scene\'s own authored duration is what the pace is measured against');
});

test('T3: a commit is refused for a Scene whose material is another schema, never guessed at', () => {
  const v = view();
  v.document.scenes[1].presentation = {schema: 'oi.journey-scene/v0', scene: {id: 'sceneTwo', duration: 14}, saved: null};
  assert.equal(savedDuration(v, TWO), null);
  assert.equal(planPaceCommit(v, draftOf([{scene_ref: TWO, dwell_seconds: 9}])).ok, false);
});

// ---- T9: the draft rides the presence entry with its basis

test('T9: a saved pace draft rides the presence entry with its basis, and is read back as current on the same basis', () => {
  const storage = memoryStorage();
  reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  const kept = savePaceDraft({
    reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE,
    draft: draftForPresence(draftOf([{scene_ref: ONE, dwell_seconds: 8}]), 'ql.techne:reading:probe'), storage,
  });
  assert.equal(kept, true);
  assert.deepEqual(savedEntry(storage).draft, {
    basis_reading_ref: 'ql.techne:reading:probe', basis_revision: '7', scene_order: [ONE, TWO], pace: [{scene_ref: ONE, dwell_seconds: 8}],
  });
  const stored = paceDraftOf({reading: reading(), revision: 7, storage});
  assert.equal(stored.standing, 'current');
  assert.deepEqual(sequenceOfDraft(stored.draft, EXPRESSION).pace, [{scene_ref: ONE, dwell_seconds: 8}]);
});

test('T9: a position write (a return, a strip move) keeps the pace draft; it is never dropped by moving the Scene', () => {
  const storage = memoryStorage();
  savePaceDraft({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE,
    draft: draftForPresence(draftOf([{scene_ref: ONE, dwell_seconds: 8}]), 'ql.techne:reading:probe'), storage});
  recordJourneyPosition({reading: reading(), expression_ref: EXPRESSION, scene_ref: TWO, storage});
  reconcileJourneyPresence({reading: reading(), expression_ref: EXPRESSION, scene_ref: TWO, storage});
  assert.equal(savedEntry(storage).scene_ref, TWO);
  assert.equal(paceDraftOf({reading: reading(), revision: 7, storage}).standing, 'current', 'the draft survives the position writes');
});

test('T9: a draft whose basis revision moved is named stale and is never applied silently', () => {
  const storage = memoryStorage();
  savePaceDraft({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE,
    draft: draftForPresence(draftOf([{scene_ref: ONE, dwell_seconds: 8}]), 'ql.techne:reading:probe'), storage});
  const later = reconcileJourneyPresence({reading: reading({snapshot: {revision: 'rev-2', basis_ref: null}}), expression_ref: EXPRESSION, scene_ref: ONE, storage});
  assert.equal(later.notice, FIELD_ADVANCED_NOTICE, 'the position is disclosed as before');
  const stored = paceDraftOf({reading: reading(), revision: 8, storage});
  assert.equal(stored.standing, 'stale', 'the Expression moved to revision 8, so the draft is stale');
  const view8 = paceViewOf({view: view(), sceneRefs: [ONE, TWO], stored, canSave: true, epoch: 0});
  assert.equal(view8.standing, 'stale');
  assert.deepEqual(view8.drafted, {}, 'a stale draft shows no paced value as current');
  assert.equal(view8.basisRevision, '7', 'the stale draft names the revision it was taken at');
  assert.equal(paceDraftOf({reading: reading({reading_ref: 'ql.techne:reading:other'}), revision: 7, storage}).standing, 'stale', 'a draft on another reading is stale too');
});

test('T9: re-applying a stale draft takes it onto the current revision as a draft again, and discarding it clears it', () => {
  const storage = memoryStorage();
  // The draft was taken when GHOST was still a beat of the Journey; the Expression has since moved on without it.
  const takenWithGhost = draftOf([{scene_ref: ONE, dwell_seconds: 8}, {scene_ref: GHOST, dwell_seconds: 5}], {scene_order: [ONE, GHOST]});
  assert.equal(savePaceDraft({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE,
    draft: draftForPresence(takenWithGhost, 'ql.techne:reading:probe'), storage}), true);
  const stale = paceDraftOf({reading: reading(), revision: 8, storage});
  const reapplied = {...newPaceDraft(EXPRESSION, '8', [ONE, TWO]), pace: stale.draft.pace.filter((p) => [ONE, TWO].includes(p.scene_ref))};
  assert.equal(savePaceDraft({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE,
    draft: draftForPresence(reapplied, 'ql.techne:reading:probe'), storage}), true);
  const current = paceDraftOf({reading: reading(), revision: 8, storage});
  assert.equal(current.standing, 'current');
  assert.deepEqual(current.draft.pace, [{scene_ref: ONE, dwell_seconds: 8}], 'the beat no longer in the Journey is dropped, the rest kept');
  assert.equal(savePaceDraft({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE, draft: null, storage}), true);
  assert.equal(paceDraftOf({reading: reading(), revision: 8, storage}), undefined, 'discarding clears the draft and nothing else');
  assert.equal(savedEntry(storage).scene_ref, ONE);
});

test('T9: a draft that paces a beat outside its own order is refused on write, and nothing is stored', () => {
  const storage = memoryStorage();
  const drifted = draftOf([{scene_ref: GHOST, dwell_seconds: 5}]);
  assert.equal(savePaceDraft({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE,
    draft: draftForPresence(drifted, 'ql.techne:reading:probe'), storage}), false);
  assert.equal(storage.map.has(KEY), false, 'a draft the reader would drop is never written');
});

test('T9: a store that refuses the write reports it, so the caller refuses the pace rather than holding a second copy', () => {
  const refusing = {getItem: () => null, setItem() { throw new Error('QuotaExceededError'); }};
  const kept = savePaceDraft({reading: reading(), expression_ref: EXPRESSION, scene_ref: ONE,
    draft: draftForPresence(draftOf([{scene_ref: ONE, dwell_seconds: 8}]), 'ql.techne:reading:probe'), storage: refusing});
  assert.equal(kept, false);
  assert.equal(paceDraftOf({reading: reading(), revision: 7, storage: refusing}), undefined);
});

test('T9: a corrupt draft is dropped with its entry, never repaired into a guess', () => {
  const broken = {[EXPRESSION]: {
    schema: 'ql.techne-journey-presence/v1', subject_ref: EXPRESSION, reading_ref: 'ql.techne:reading:probe', snapshot_revision: 'rev-1',
    expression_ref: EXPRESSION, scene_ref: ONE, draft: {scene_order: [ONE], pace: [{scene_ref: ONE, dwell_seconds: 8}]},
  }};
  assert.equal(paceDraftOf({reading: reading(), revision: 7, storage: memoryStorage(JSON.stringify(broken))}), undefined, 'a draft with no basis is drifted');
  const pacedOutside = {[EXPRESSION]: {...broken[EXPRESSION], draft: {basis_reading_ref: 'ql.techne:reading:probe', basis_revision: '7', scene_order: [ONE], pace: [{scene_ref: TWO, dwell_seconds: 8}]}}};
  assert.equal(paceDraftOf({reading: reading(), revision: 7, storage: memoryStorage(JSON.stringify(pacedOutside))}), undefined, 'a pace for a beat the draft does not hold is drifted');
});

// ---- The beat view

test('T3: the pace view shows no draft, a current draft with its paced beats, and a stale draft with none applied; duplicate beats are not paceable', () => {
  const v = view();
  assert.equal(paceViewOf({view: v, sceneRefs: [ONE, TWO], stored: undefined, canSave: true, epoch: 0}).standing, 'none');
  const current = {standing: 'current', draft: draftOf([{scene_ref: ONE, dwell_seconds: 8}])};
  const shown = paceViewOf({view: v, sceneRefs: [ONE, TWO], stored: current, canSave: false, epoch: 3});
  assert.equal(shown.standing, 'draft');
  assert.deepEqual(shown.drafted, {[ONE]: 8});
  assert.deepEqual(shown.saved, {[ONE]: 12, [TWO]: 14}, 'each beat shows its saved duration beside its draft');
  assert.equal(shown.canSave, false);
  assert.equal(shown.epoch, 3);
  assert.equal(shown.paceable, true);
  assert.equal(paceViewOf({view: v, sceneRefs: [ONE, ONE], stored: undefined, canSave: true, epoch: 0}).paceable, false);
});

// ---- Source wiring: the reorder stays native and at once; the pace is saved only through the labelled step

const here = fileURLToPath(new URL('.', import.meta.url));
const instrumentSource = readFileSync(join(here, '../src/journeyInstrument.tsx'), 'utf8');
const appSource = readFileSync(join(here, '../src/app.ts'), 'utf8');

test('T3: reorder still routes to the owner at once, and the pace draft never enters the reorder request', () => {
  const onMove = instrumentSource.slice(instrumentSource.indexOf('onMove={(sceneRef,toIndex)=>{'), instrumentSource.indexOf('onMove={(sceneRef,toIndex)=>{') + 900);
  assert.ok(onMove.includes('reorderSceneRequest({reading,doc:view!.document,draft:moveBeat(draftFromBeats(beats(reading).beats,view!.document.expression_ref),sceneRef,toIndex)});'),
    'the reorder is built from the disclosed order, with no pace');
  assert.ok(onMove.includes('void host.editExpression(routed.request)'), 'the reorder is sent to the owner at once');
  assert.ok(!onMove.includes('paceActions') && !onMove.includes('savePaceDraft') && !onMove.includes('commitPace'), 'the reorder path touches no pace state');
});

test('T3: the pace save is one labelled step: the host commits the paced edits, and the instrument refuses an unacknowledged save with the draft kept', () => {
  assert.ok(instrumentSource.includes('void commit(plan.edits.map(edit=>({sceneId:edit.sceneId,seconds:edit.seconds})),label)'),
    'the save hands the planned edits to the host as one labelled commit');
  assert.ok(instrumentSource.includes('was not accepted by the native owner. The draft is kept'), 'an unacknowledged save is named and the draft kept');
  assert.ok(instrumentSource.includes('was refused: ${failure(error)}. The draft is kept.'), 'a refused save passes the owner\'s reason through and keeps the draft');
  assert.ok(instrumentSource.includes('keepPace(null);paceEpoch++;busy=false;'), 'the draft clears only once the owner acknowledged the save');
});

test('T3: app.ts wires the pace save to the timeline retime as one labelled step, through the Save path', () => {
  const commit = appSource.slice(appSource.indexOf('commitPace:async(edits,label)=>{'), appSource.indexOf('commitPace:async(edits,label)=>{') + 700);
  assert.ok(commit.includes("throw Error(\"Save the open work before changing this Journey's pace.\")"), 'the pace save carries the open-work guard');
  assert.ok(commit.includes('changed(()=>{for(const edit of edits)retimeScene(store.document,edit.sceneId,{duration:edit.seconds});},true,label);'),
    'each beat is retimed through the timeline retime inside one labelled change');
  assert.ok(commit.includes('return await commitNativeRecorded()===true;'), 'the labelled change is acknowledged through the Save path');
});
