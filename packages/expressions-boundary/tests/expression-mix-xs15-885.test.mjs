/** O-I #747 round 885, XS15's limits (DLW build ruling 2026-11-06, the lead's): Level and Main are the set's settings, as a mixer's are in
 * Live, so the Expression keeps them in its own document and reads them on load; the Activator is its own state, kept beside them ("The
 * Expression plays, or it does not. Off, its scenes do not launch, and its track is dimmed", DLW.md §20.1 The mixer row). Absent, each
 * reads as its default: unity, unity, on. One owner op sets them, carried by composition_set as the transport's Quantize is; the scenes
 * reading discloses them to the shell. Real authoring model, real composition owner; nothing is stubbed but the native acknowledgement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeSceneEdit} from '../src/sceneEdits.ts';
import {projectNativeScenes} from '../src/scenes.ts';
import {isNativeScenesReading} from '../src/scenesValidation.ts';
import * as model from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import * as sound from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/native-field/entitySound.ts';
import {compositionProperties} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelComposition.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';

const {blankScene, clone, fieldStudies, validateJourney} = model;
const E = 'expression:mix';
const S = n => `${E}:scene:s${n}`;
/** Two native Scenes, the first selected; `properties` the Expression's own. */
function seed(properties = null) {
  const scenes = [10, 8].map((duration, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Mix', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: [],
    ...(properties ? {presentation: {schema: 'oi.journey-properties/v1', description: '', loop: false, ...properties}} : {})});
}

test('XS15 r885: the Expression keeps its mixer — Volume, Main and the Activator — in its own properties, and reads them on load', () => {
  assert.deepEqual(sound.EXPRESSION_MIX_DEFAULT, {level: 1, main: 1, active: true}, 'unity, unity, on: what an Expression that keeps none reads as');
  const j = fieldStudies(); j.mix = {level: 0.5, main: 2, active: false};
  assert.deepEqual(validateJourney(clone(j)).mix, {level: 0.5, main: 2, active: false});
  assert.deepEqual(compositionProperties(j).mix, {level: 0.5, main: 2, active: false}, 'carried by composition_set, as the Quantize is');
  assert.equal('mix' in compositionProperties(fieldStudies()), false, 'none kept: none carried');
  for (const [bad, words] of [[{level: 3}, /A sound level runs from silence to \+6 dB\./], [{main: -0.1}, /A sound level runs from silence to \+6 dB\./],
    [{level: NaN}, /Non-finite value\./], [{active: 'no'}, /The Expression plays or it does not \(true or false\)\./],
    [{pan: 0}, /The Expression's mixer has no pan\./], [[1], /The Expression's mixer is a set of settings\./]]) {
    j.mix = bad; assert.throws(() => validateJourney(clone(j)), words, JSON.stringify(bad));
  }
  assert.deepEqual(seed({mix: {level: 0.25, active: false}}).journey.mix, {level: 0.25, active: false}, 'the native document\'s properties are read');
  assert.equal(seed().journey.mix, undefined);
  assert.throws(() => seed({mix: {level: 9}}), /A sound level runs from silence to \+6 dB\./, 'a document that says more than the law is not read');
  assert.deepEqual(sound.expressionMixOf(undefined), {level: 1, main: 1, active: true});
  assert.deepEqual(sound.expressionMixOf({main: 0.5}), {level: 1, main: 0.5, active: true});
});

test('XS15 r885: one owner op sets the mixer; null returns a setting to its default; no scene is touched', () => {
  const view = seed();
  const set = (journey, settings) => prepareNativeSceneEdit(view, clone(journey), {operation: 'mix', set: settings});
  const level = set(view.journey, {level: 0.25});
  assert.equal(level.label, 'Set the Expression\'s mixer');
  assert.deepEqual(level.snapshot.journey.mix, {level: 0.25});
  const carried = level.request.changes.filter(change => change.change === 'composition_set');
  assert.equal(carried.length, 1); assert.deepEqual(carried[0].presentation.mix, {level: 0.25});
  assert.equal(level.request.changes.some(change => change.change === 'scene_material_set'), false, 'no scene is touched');
  const off = set(level.snapshot.journey, {active: false, main: 2});
  assert.deepEqual(off.snapshot.journey.mix, {level: 0.25, active: false, main: 2}, 'each setting by its own key; the others stand');
  assert.deepEqual(set(off.snapshot.journey, {level: null}).snapshot.journey.mix, {active: false, main: 2}, 'null: back to unity');
  const kept = seed({mix: {level: 0.25, main: 2, active: false}});
  const cleared = prepareNativeSceneEdit(kept, clone(kept.journey), {operation: 'mix', set: {level: null, main: null, active: null}});
  assert.equal(cleared.snapshot.journey.mix, undefined, 'every setting at its default: the Expression keeps none');
  assert.equal('mix' in cleared.request.changes.find(change => change.change === 'composition_set').presentation, false, 'and the owner is told so');
  for (const [settings, words] of [[{level: 3}, /A sound level runs from silence to \+6 dB\./], [{active: 1}, /The Expression plays or it does not/],
    [{pan: 0}, /The Expression's mixer has no pan\./], [{}, /Name the mixer settings to change\./], [null, /Name the mixer settings to change\./]])
    assert.throws(() => set(view.journey, settings), words, JSON.stringify(settings));
});

test('XS15 r885: the scenes reading discloses the mixer as it stands, its defaults where the Expression keeps none', () => {
  const basis = {expression_ref: E, revision: 4, scene_ref: S(1)};
  const plain = seed(), reading = projectNativeScenes(plain.journey, plain);
  assert.deepEqual(reading.mix, {level: 1, main: 1, active: true});
  assert.equal(isNativeScenesReading(reading, basis), true);
  const kept = seed({mix: {main: 0.5, active: false}});
  assert.deepEqual(projectNativeScenes(kept.journey, kept).mix, {level: 1, main: 0.5, active: false});
  for (const mix of [{level: 3, main: 1, active: true}, {level: 1, main: 1}, {level: 1, main: 1, active: true, pan: 0}, 'on'])
    assert.equal(isNativeScenesReading({...reading, mix}, basis), false, JSON.stringify(mix));
  const {mix: _absent, ...older} = reading;
  assert.equal(isNativeScenesReading(older, basis), true, 'an older frame does not say: no mixer is read');
});
