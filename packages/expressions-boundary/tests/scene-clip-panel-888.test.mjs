/** O-I #747 round 888: the Clip panel's own refusals, proven on the Expression's owner (manual §20.1 The Clip panel, Rules).
 * XS06 "I set how long a scene holds and how long its change to the next takes": a value outside its range is refused and the range is named.
 * XS11 "I lock a finished scene so it cannot change by accident": the scene refuses edits until it is unlocked, each refusal said in words.
 * Each Clip panel act is one scene edit of the owner (sceneEdits.ts prepareNativeSceneEdit), planned on the captured native Scenes. Real
 * authoring model, real composition owner; nothing is stubbed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeSceneEdit} from '../src/sceneEdits.ts';
import {blankScene, clone} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';

const E = 'expression:clip-panel';
const S = n => `${E}:scene:s${n}`;
/** Three native Scenes of 10, 8 and 12 s with a 1 s change, the first selected; `locked` locks that one. */
function seed({locked = null} = {}) {
  const scenes = [10, 8, 12].map((duration, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    if (locked === i + 1) scene.clip = {locked: true};
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 7, title: 'Clip panel', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
const plan = (intent, view = seed()) => prepareNativeSceneEdit(view, clone(view.journey), intent);
const scene = (p, n) => p.snapshot.journey.scenes.find(row => row.id === S(n));

test('XS06: Duration holds 1–3600 s; a value outside it is refused with the range named, and nothing is planned', () => {
  for (const seconds of [1, 90, 3600]) {
    const p = plan({operation: 'pacing', scene_ref: S(2), duration: seconds});
    assert.equal(p.label, 'Set Scene pacing');
    assert.equal(scene(p, 2).duration, seconds, `${seconds} s is a Duration the scene holds`);
  }
  for (const seconds of [0, 0.5, 3601, -4, Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() => plan({operation: 'pacing', scene_ref: S(2), duration: seconds}), {message: 'Scene duration must be 1–3600 seconds'},
      `${seconds} s is refused and the range is named`);
});

test('XS06: Transition holds 0–30 s, longer than the Duration when wanted (a slow swell); outside it is refused with the range named', () => {
  const swell = plan({operation: 'pacing', scene_ref: S(2), transition: 20});
  assert.equal(scene(swell, 2).transition, 20, 'a Transition longer than the 8 s Duration is taken');
  assert.equal(scene(swell, 2).duration, 8, 'and the Duration stands');
  assert.equal(scene(plan({operation: 'pacing', scene_ref: S(2), transition: 0}), 2).transition, 0, 'a cut is 0 s');
  for (const seconds of [-1, 30.5, 31, Number.NaN])
    assert.throws(() => plan({operation: 'pacing', scene_ref: S(2), transition: seconds}), {message: 'Scene transition must be 0–30 seconds'});
  assert.throws(() => plan({operation: 'pacing', scene_ref: S(2)}), {message: 'Supply a Scene duration or transition'});
});

test('XS11: a locked scene refuses every edit with the reason, until it is unlocked', () => {
  const locked = seed({locked: 2});
  const reason = {message: 'This Scene is locked: unlock it to change it'};
  assert.throws(() => plan({operation: 'rename', scene_ref: S(2), title: 'Bridge'}, locked), reason, 'its name');
  assert.throws(() => plan({operation: 'pacing', scene_ref: S(2), duration: 20}, locked), reason, 'its Duration');
  assert.throws(() => plan({operation: 'pacing', scene_ref: S(2), transition: 4}, locked), reason, 'its Transition');
  assert.throws(() => plan({operation: 'clip', scene_ref: S(2), set: {colour: '#3366aa'}}, locked), reason, 'its colour');
  assert.throws(() => plan({operation: 'clip', scene_ref: S(2), set: {signature: '5:3'}}, locked), reason, 'its Signature');
  assert.throws(() => plan({operation: 'clip', scene_ref: S(2), set: {locked: null, colour: '#3366aa'}}, locked), reason,
    'an unlock carried with another change is refused whole: only unlocking alone is taken');
  // The other scenes stay editable.
  assert.equal(scene(plan({operation: 'rename', scene_ref: S(3), title: 'Bridge'}, locked), 3).name, 'Bridge');
  // Unlocking alone is taken; on what it leaves, the edit lands.
  const unlocked = plan({operation: 'clip', scene_ref: S(2), set: {locked: null}}, locked);
  assert.equal(unlocked.label, 'Set the scene\'s clip settings');
  assert.equal(scene(unlocked, 2).clip, undefined, 'the scene holds no clip setting once unlocked');
  const after = kernelDocumentToJourney({...locked.document, scenes: locked.document.scenes.map(row => row.scene_ref !== S(2) ? row
    : {...row, presentation: {...row.presentation, scene: scene(unlocked, 2)}})});
  assert.equal(scene(plan({operation: 'rename', scene_ref: S(2), title: 'Bridge'}, after), 2).name, 'Bridge', 'unlocked, it renames');
  assert.equal(scene(plan({operation: 'pacing', scene_ref: S(2), duration: 20}, after), 2).duration, 20, 'unlocked, it holds 20 s');
});
