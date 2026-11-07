/** O-I #747 round 886, at the boundary:
 *  - the Expression's colour (DLW.md:8911 "The track head shows the Expression's title and colour"): one owner op sets it or clears it,
 *    carried by composition_set beside its description; the scenes reading discloses it to the shell;
 *  - Solo (DLW build ruling 2026-11-06, the lead's derivation: the mixer row maps Live's controls, DLW.md:8919–8929, and a Live Set keeps
 *    its solo states): the mixer op sets it with the Activator, and the scenes reading discloses it;
 *  - the Field's Level (§20.2 Field, "Level | −60 to 0 dB | −12 dB | Sets the loudness of the whole field"): a panel setting of the scene's
 *    composition, a number of dB, addressed to the Field;
 *  - the one gain the frame announces beside the Torus's effects (parameters.mix, 0..4), read exact so the shell can hand it to the
 *    desktop's engine.
 * Real authoring model, real composition owner; nothing is stubbed but the native acknowledgement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeSceneEdit} from '../src/sceneEdits.ts';
import {projectNativeScenes} from '../src/scenes.ts';
import {isNativeScenesReading} from '../src/scenesValidation.ts';
import {FIELD_PANEL_SETTINGS} from '../src/nativeFieldPanelSettings.ts';
import {applyNativeDeviceChanges, validateNativeFieldPanelChange} from '../src/nativeDeviceEdits.ts';
import {parameterAddresses} from '../src/parameterAddress.ts';
import {readHostedParameters} from '../src/index.ts';
import * as model from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';

const {blankScene, clone} = model;
const E = 'expression:colour';
const S = n => `${E}:scene:s${n}`;
function seed(properties = null) {
  const scenes = [10, 8].map((duration, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Colour', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: [],
    ...(properties ? {presentation: {schema: 'oi.journey-properties/v1', description: '', loop: false, ...properties}} : {})});
}
const carried = edit => edit.request.changes.find(change => change.change === 'composition_set')?.presentation;

test('r886: one owner op sets the Expression\'s colour or clears it, carried beside its description; no scene is touched', () => {
  const view = seed();
  const colour = colour => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'colour', colour});
  const set = colour('#5480E4');
  assert.equal(set.label, 'Set the Expression\'s colour');
  assert.equal(set.snapshot.journey.colour, '#5480E4');
  assert.equal(carried(set).colour, '#5480E4');
  assert.equal(set.request.changes.some(change => change.change === 'scene_material_set'), false, 'no scene is touched');
  const kept = seed({colour: '#FF94A6'});
  assert.equal(kept.journey.colour, '#FF94A6', 'read on load');
  const cleared = prepareNativeSceneEdit(kept, clone(kept.journey), {operation: 'colour', colour: null});
  assert.equal(cleared.snapshot.journey.colour, undefined);
  assert.equal('colour' in carried(cleared), false, 'cleared: the owner is told it keeps none');
  for (const bad of ['blue', '#12345', 7, undefined])
    assert.throws(() => colour(bad), /An Expression's colour is a palette colour \(#RRGGBB\)\./, JSON.stringify(bad));
});

test('r886: the mixer op sets Solo beside the Activator, and composition_set carries it', () => {
  const view = seed();
  const solo = prepareNativeSceneEdit(view, clone(view.journey), {operation: 'mix', set: {solo: true}});
  assert.deepEqual(solo.snapshot.journey.mix, {solo: true});
  assert.deepEqual(carried(solo).mix, {solo: true});
  const soloed = seed({mix: {solo: true}});
  assert.equal(prepareNativeSceneEdit(soloed, clone(soloed.journey), {operation: 'mix', set: {solo: null}}).snapshot.journey.mix, undefined,
    'Solo off is its default: the Expression keeps none');
  assert.throws(() => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'mix', set: {solo: 'on'}}), /Solo is on or off \(true or false\)\./);
});

test('r886: the scenes reading discloses the colour the Expression keeps, and its Solo', () => {
  const basis = {expression_ref: E, revision: 4, scene_ref: S(1)};
  const plain = seed(), reading = projectNativeScenes(plain.journey, plain);
  assert.equal('colour' in reading, false, 'none kept: none said');
  assert.deepEqual(reading.mix, {level: 1, main: 1, active: true, solo: false});
  assert.equal(isNativeScenesReading(reading, basis), true);
  const kept = seed({colour: '#5480E4', mix: {solo: true}}), keptReading = projectNativeScenes(kept.journey, kept);
  assert.equal(keptReading.colour, '#5480E4');
  assert.equal(keptReading.mix.solo, true);
  assert.equal(isNativeScenesReading(keptReading, basis), true);
  for (const colour of ['blue', '#12345', 7, null]) assert.equal(isNativeScenesReading({...keptReading, colour}, basis), false, JSON.stringify(colour));
  for (const mix of [{level: 1, main: 1, active: true, solo: 'on'}, {level: 1, main: 1, solo: true}, {level: 1, main: 1, active: true, solo: true, pan: 0}])
    assert.equal(isNativeScenesReading({...reading, mix}, basis), false, JSON.stringify(mix));
  assert.equal(isNativeScenesReading({...reading, mix: {level: 1, main: 1, active: true}}, basis), true, 'a frame from before Solo says none');
});

test('r886: the Field\'s Level is a panel setting of the scene\'s composition, −60 to 0 dB, addressed to the Field', () => {
  assert.deepEqual(FIELD_PANEL_SETTINGS.fieldLevel, {target: 'composition', type: 'number', min: -60, max: 0});
  for (const value of [-60, -12, -0.5, 0]) assert.deepEqual(validateNativeFieldPanelChange({kind: 'panel-setting', key: 'fieldLevel', value}), {kind: 'panel-setting', key: 'fieldLevel', value});
  for (const value of [-61, 0.5, '-12', NaN, true])
    assert.throws(() => validateNativeFieldPanelChange({kind: 'panel-setting', key: 'fieldLevel', value}), /Choose an admitted native Field panel setting and value\./, String(value));
  const journey = model.blankJourney();
  const next = applyNativeDeviceChanges(journey, journey.scenes[0].id, [{kind: 'panel-setting', key: 'fieldLevel', value: -6}]);
  assert.equal(next.scenes[0].composition.fieldLevel, -6, 'written at the scene\'s composition');
  assert.equal(journey.scenes[0].composition.fieldLevel, undefined, 'the caller\'s document stands');
  assert.deepEqual(parameterAddresses({kind: 'panel-setting', key: 'fieldLevel', value: -6}).addresses,
    [{family: 'field', deviceInstance: null, key: 'fieldLevel', type: 'number', range: {min: -60, max: 0}, writePath: 'composition.fieldLevel'}]);
});

test('r886: the frame\'s one gain beside the Torus\'s effects is read exact, 0..4, and absent where the frame announces none', () => {
  const parameters = over => ({muted: false, level: 1, scale: {unitsPerMetre: 120, mode: 'domain-follow'}, cadence: null, refusal: null, ...over});
  assert.equal(readHostedParameters(parameters({mix: 0.5})).mix, 0.5);
  assert.equal(readHostedParameters(parameters({mix: 0})).mix, 0);
  assert.equal('mix' in readHostedParameters(parameters()), false);
  for (const mix of [-0.1, 4.5, NaN, '1', null]) assert.match(readHostedParameters(parameters({mix})), /^parameters\.mix: /, String(mix));
});
