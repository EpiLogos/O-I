// O-I #747 round 894, the port ledger's add-built-in and chakra-add: a built-in preset's objects added to the open Scene as one native edit
// (the app's add-built-in, app.ts:642, and chakra-add, app.ts:669). The change is the owner's `formation-preset` (nativePresets.ts):
// Field studies, A small language and Seven centres add the objects of their first scene; the Semantic Chakra Body adds its seven yantra
// centres with their meanings, the binding law of the app's mergeSemanticStarter: the field's profile, affinity and global colour gain are
// the starter's own, each binding keeps its centre, colour and modulation, its carrier points at the new centre, and its identity is fresh.
// Every object takes fresh entity and state identities, so a preset added twice never repeats one; the scene's 32 objects bound it.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyNativeFormationPresets, FORMATION_PRESETS, presetScene} from '../src/nativePresets.ts';
import {blankJourney, validateJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {COMPOSITION_PRESETS} from '../../../desktop/cradle/expressions-app/src/engine/compositionPresets.ts';
import {parameterAddresses} from '../src/parameterAddress.ts';

const scene = journey => journey.scenes[0];
const fresh = () => blankJourney();

test('the presets are the app\'s four, named as the browser names them', () => {
  assert.deepEqual(FORMATION_PRESETS.map(row => row.preset), ['field-studies', 'small-language', 'seven-centres', 'chakra-body']);
  for (const row of FORMATION_PRESETS) assert.ok(row.name && row.summary, row.preset);
});

test('a built-in preset adds the objects of its first scene, each with fresh identities, as one edit', () => {
  for (const preset of ['field-studies', 'small-language', 'seven-centres']) {
    const before = fresh(), source = presetScene(preset);
    const after = applyNativeFormationPresets(before, scene(before).id, [{kind: 'formation-preset', preset}]);
    assert.equal(scene(before).entities.length, 0, 'the journey sent is not changed in place');
    const added = scene(after).entities;
    assert.equal(added.length, source.entities.length, `${preset}: every object of the first scene`);
    assert.deepEqual(added.map(entity => entity.name), source.entities.map(entity => entity.name), `${preset}: in the preset's order`);
    for (const [index, entity] of added.entries()) {
      assert.notEqual(entity.id, source.entities[index].id, `${preset}: a fresh entity identity`);
      for (const step of entity.sequence.steps) assert.ok(!source.entities[index].sequence.steps.some(old => old.id === step.id), `${preset}: fresh state identities`);
      // The engine entity it was built from addresses this object, as the owner's correspondence holds it (sceneCorrespondence.ts).
      if (source.entities[index].native) assert.equal(entity.native.id, entity.id, `${preset}: its engine entity carries its identity`);
      const own = value => ({...value, id: 0, ...(value.native ? {native: {...value.native, id: 0}} : {}),
        sequence: {...value.sequence, steps: value.sequence.steps.map(step => ({...step, id: 0}))}});
      assert.deepEqual(own(entity), own(source.entities[index]), `${preset}: the object is the preset's own`);
    }
    validateJourney(after);
    const twice = applyNativeFormationPresets(after, scene(after).id, [{kind: 'formation-preset', preset}]);
    assert.equal(new Set(scene(twice).entities.map(entity => entity.id)).size, scene(twice).entities.length, `${preset}: added twice, no identity repeats`);
  }
});

test('a built-in preset adds its objects only, as the app\'s add-built-in does: Seven centres brings no meanings', () => {
  for (const preset of ['field-studies', 'small-language', 'seven-centres']) {
    const before = fresh()
    const after = applyNativeFormationPresets(before, scene(before).id, [{kind: 'formation-preset', preset}])
    assert.deepEqual(scene(after).semanticField, scene(before).semanticField, `${preset}: the field's meanings are untouched`)
  }
});

test('the Semantic Chakra Body adds seven yantra centres with their meanings, by the app\'s binding law', () => {
  const before = fresh();
  const after = applyNativeFormationPresets(before, scene(before).id, [{kind: 'formation-preset', preset: 'chakra-body'}]);
  const centres = scene(after).entities, source = presetScene('chakra-body');
  assert.equal(centres.length, 7);
  assert.ok(centres.every(entity => entity.kind === 'formation' && entity.shape === 'yantra' && entity.yantraId), 'yantra centres, each keeping its yantra');
  assert.deepEqual(centres.map(entity => entity.yantraId), source.entities.map(entity => entity.yantraId), 'Root to Crown, as the starter has them');
  assert.deepEqual(centres.map(entity => entity.tint), source.entities.map(entity => entity.tint), 'each with its tint');
  const field = scene(after).semanticField, built = COMPOSITION_PRESETS.find(row => row.id === 'chakra_body').build().semanticField;
  assert.equal(field.enabled, true);
  assert.deepEqual(field.profile, built.profile, 'the starter\'s profile');
  assert.deepEqual(field.affinity, built.affinity, 'the starter\'s affinity');
  assert.equal(field.globalColorGain, built.globalColorGain, 'the starter\'s global colour gain');
  assert.equal(field.bindings.length, source.semanticField.bindings.length);
  for (const [index, binding] of field.bindings.entries()) {
    const was = source.semanticField.bindings[index];
    assert.notEqual(binding.id, was.id, 'a fresh binding identity');
    const carrier = binding.carriers.find(item => item.kind === 'entity');
    const at = source.entities.findIndex(entity => entity.id === was.carriers.find(item => item.kind === 'entity').id);
    assert.equal(carrier.id, centres[at].id, 'its carrier points at the new centre');
    assert.deepEqual({...binding, id: 0, carriers: 0}, {...was, id: 0, carriers: 0}, 'its centre, colour and modulation are the starter\'s');
  }
  validateJourney(after);
});

test('the scene\'s 32 objects bound a preset; an unknown preset or an extra key is refused; nothing changes on a refusal', () => {
  let journey = fresh();
  journey = applyNativeFormationPresets(journey, scene(journey).id, [{kind: 'formation-preset', preset: 'chakra-body'}, {kind: 'formation-preset', preset: 'chakra-body'},
    {kind: 'formation-preset', preset: 'chakra-body'}, {kind: 'formation-preset', preset: 'chakra-body'}]);
  assert.equal(scene(journey).entities.length, 28);
  assert.throws(() => applyNativeFormationPresets(journey, scene(journey).id, [{kind: 'formation-preset', preset: 'chakra-body'}]), /32 formations and pins/);
  assert.equal(scene(journey).entities.length, 28);
  const blank = fresh()
  assert.throws(() => applyNativeFormationPresets(blank, scene(blank).id, [{kind: 'formation-preset', preset: 'nine-centres'}]), /Choose a preset the browser offers/);
  assert.throws(() => applyNativeFormationPresets(blank, scene(blank).id, [{kind: 'formation-preset', preset: 'chakra-body', position: {x: 0, y: 0, z: 0}}]), /carries only its preset/);
  assert.throws(() => applyNativeFormationPresets(fresh(), 'scene:gone', [{kind: 'formation-preset', preset: 'chakra-body'}]), /no longer in this Expression/);
});

test('a preset add is a structural edit: it addresses no parameter', () => {
  assert.deepEqual(parameterAddresses({kind: 'formation-preset', preset: 'chakra-body'}), {addresses: [], structural: 'formation-preset'});
});
