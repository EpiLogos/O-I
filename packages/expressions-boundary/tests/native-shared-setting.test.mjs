/** The shared-setting change: the app's own toggleShared (sharedSettings.ts) moves a Field parameter between Scene-local and
 * Expression-shared. Real authoring model, real reducer; no owner, store or renderer is stubbed. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyNativeDeviceChanges, validateNativeSharedSettingChange} from '../src/nativeDeviceEdits.ts';
import {SHAREABLE_FIELD_BINDINGS, readSharedFieldTargets, sharedFieldBinding, sharedFieldTarget, sharedSettingChange} from '../src/nativeSharedSettings.ts';
import {NATIVE_BINDINGS, bindValue} from '../src/parameters.ts';
import {blankJourney, clone} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {globalPath, isShared, POINTER_PATHS} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings.ts';

const read = (root, path) => path.split('.').reduce((value, key) => value?.[key], root);
/** One Expression with two Scenes; the second is a copy of the first under its own id. */
function twoScenes() {
  const journey = blankJourney();
  journey.scenes.push({...clone(journey.scenes[0]), id: 'scene:second', name: 'Second'});
  return journey;
}
const shareable = SHAREABLE_FIELD_BINDINGS.find(binding => binding.bind.startsWith('field.params.'));

test('only the app\'s global Field paths can be shared; pointer paths keep their own pointer-scope setting', () => {
  assert.ok(SHAREABLE_FIELD_BINDINGS.length > 20, 'the registry exposes many shareable Field parameters');
  for (const binding of SHAREABLE_FIELD_BINDINGS) {
    assert.equal(globalPath(binding.bind), true, binding.bind);
    assert.equal(POINTER_PATHS.includes(binding.bind), false, binding.bind);
  }
  const pointer = NATIVE_BINDINGS.find(binding => POINTER_PATHS.includes(binding.bind));
  assert.ok(pointer, 'the registry has a pointer binding to refuse');
  assert.equal(sharedFieldBinding(sharedFieldTarget(pointer)), undefined);
  assert.equal(sharedFieldBinding('field.__proto__'), undefined);
  assert.equal(sharedFieldBinding(undefined), undefined);
});

test('the validator admits one exact target and a boolean, and refuses every other shape', () => {
  const target = sharedFieldTarget(shareable);
  assert.deepEqual(validateNativeSharedSettingChange(sharedSettingChange(target, true)), {kind: 'shared-setting', target, shared: true});
  assert.deepEqual(validateNativeSharedSettingChange(sharedSettingChange(target, false)), {kind: 'shared-setting', target, shared: false});
  const pointer = sharedFieldTarget(NATIVE_BINDINGS.find(binding => POINTER_PATHS.includes(binding.bind)));
  const refused = [
    {kind: 'shared-setting', target, shared: 'yes'}, {kind: 'shared-setting', target, shared: 1}, {kind: 'shared-setting', target},
    {kind: 'shared-setting', target: 'field.absent', shared: true}, {kind: 'shared-setting', target: pointer, shared: true},
    {kind: 'shared-setting', target: 'entity:x:position.x', shared: true}, {kind: 'shared-setting', target, shared: true, scope: 'named'},
    {kind: 'shared-setting', target, shared: true, entity_id: 'e'}, {kind: 'parameter', target, shared: true}, null, 'field.x',
  ];
  for (const change of refused) assert.throws(() => validateNativeSharedSettingChange(change), /share|Choose/, JSON.stringify(change));
});

test('sharing copies the Scene\'s value into the Expression; un-sharing copies the shared value back into every Scene', () => {
  const journey = twoScenes(), [first, second] = journey.scenes, target = sharedFieldTarget(shareable), path = shareable.bind;
  bindValue(first, path, 0.31);
  bindValue(second, path, 0.77);
  const shared = applyNativeDeviceChanges(journey, first.id, [sharedSettingChange(target, true)]);
  assert.equal(isShared(shared, shared.scenes[0], path), true);
  assert.equal(shared.shared.values[path], 0.31, 'the Scene\'s effective value is the Expression\'s shared value');
  assert.deepEqual(readSharedFieldTargets(shared, shared.scenes[0]), [target]);
  assert.deepEqual(readSharedFieldTargets(shared, shared.scenes[1]), [target], 'every Scene sees the shared parameter');

  const local = applyNativeDeviceChanges(shared, first.id, [sharedSettingChange(target, false)]);
  assert.equal(isShared(local, local.scenes[0], path), false);
  assert.equal(read(local.scenes[0], path), 0.31);
  assert.equal(read(local.scenes[1], path), 0.31, 'un-sharing gives the second Scene the shared value, as the app does');
  assert.deepEqual(readSharedFieldTargets(local, local.scenes[1]), []);
  assert.equal(read(journey.scenes[1], path), 0.77, 'the authored document the change started from is untouched');
});

test('requesting the state already held changes nothing, and one gesture cannot toggle the same parameter twice', () => {
  const journey = twoScenes(), target = sharedFieldTarget(shareable), path = shareable.bind;
  const same = applyNativeDeviceChanges(journey, journey.scenes[0].id, [sharedSettingChange(target, false)]);
  assert.equal(isShared(same, same.scenes[0], path), false);
  assert.equal(same.shared, undefined, 'no shared owner is created for a no-op');
  assert.throws(() => applyNativeDeviceChanges(journey, journey.scenes[0].id, [sharedSettingChange(target, true), sharedSettingChange(target, false)]), /twice/);
});

test('a batch with one refused share leaves the whole gesture unapplied', () => {
  const journey = twoScenes(), pointer = sharedFieldTarget(NATIVE_BINDINGS.find(binding => POINTER_PATHS.includes(binding.bind)));
  assert.throws(() => applyNativeDeviceChanges(journey, journey.scenes[0].id, [sharedSettingChange(sharedFieldTarget(shareable), true), sharedSettingChange(pointer, true)]), /share/);
  assert.equal(journey.shared, undefined);
  assert.equal(isShared(journey, journey.scenes[0], shareable.bind), false);
});
