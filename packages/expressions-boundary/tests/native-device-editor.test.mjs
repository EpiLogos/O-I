/** Actual authoring/history/projection/evaluation primitives. No owner stub,
 * renderer facade or fabricated telemetry; GPU and durable CAS are separate
 * acceptance paths exercised by the parent on the running candidate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyNativeDeviceChanges, readNativeDeviceEffectiveValues} from '../src/nativeDeviceEdits.ts';
import {blankJourney, entity, clone} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts';
import {toNativeConfig} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeBridge.ts';
import {effectiveScene, initialiseShared, toggleShared} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sharedSettings.ts';
import {NATIVE_BINDINGS} from '../src/parameters.ts';
import {applyAutomations, createAutomationRuntime} from '../../../desktop/cradle/expressions-app/src/engine/automation.ts';
import {compileEntityForceEmitters} from '../../../desktop/cradle/expressions-app/src/engine/forceRuntime.ts';

const address = (id, path) => `entity:${encodeURIComponent(id)}:${path}`;
function authored() {
  const journey = blankJourney();
  journey.scenes[0].entities = [entity('Body', 'A')];
  return journey;
}
const field = path => {
  const binding = NATIVE_BINDINGS.find(value => value.path === path);
  assert.ok(binding, path + ' is registered');
  return 'field.' + binding.key;
};
const evaluate = (scene, time = 0) => {
  const config = toNativeConfig(scene);
  return applyAutomations(config, config.automations, time, createAutomationRuntime()).config;
};

test('None mode preserves native spin and the production five-pixel radius floor', () => {
  const journey = authored(), sceneId = journey.scenes[0].id;
  const inserted = applyNativeDeviceChanges(journey, sceneId, [{kind: 'force-insert', position: {x: .2, y: -.1, z: .3}}]);
  const force = inserted.scenes[0].entities[1];
  const edited = applyNativeDeviceChanges(inserted, sceneId, [
    {kind: 'force-mode', entity_id: force.id, value: 'none'},
    {kind: 'parameter', target: address(force.id, 'forces.spin'), value: -2},
  ]);
  edited.scenes[0].entities[1].force.radius = .001; // legal imported native value preserved by the editor
  const config = toNativeConfig(edited.scenes[0]), compiled = compileEntityForceEmitters(config.entities, []);
  const actual = compiled.find(value => value.sourceEntityId === force.id);
  assert.ok(actual); assert.equal(actual.strength, 0); assert.equal(actual.spin, -2);
  assert.equal(actual.radius, 5); assert.equal(actual.metric, 'world3d');
  assert.deepEqual(actual.position, {x: 80, y: -40, z: 120});
  const cleared = applyNativeDeviceChanges(edited, sceneId, [{kind: 'parameter', target: address(force.id, 'forces.spin'), value: 0}]);
  assert.equal(compileEntityForceEmitters(toNativeConfig(cleared.scenes[0]).entities, []).some(value => value.sourceEntityId === force.id), false);
});

test('two inserted emitters own distinct native IDs and force contributions', () => {
  const original = authored(), sceneId = original.scenes[0].id;
  const inserted = applyNativeDeviceChanges(original, sceneId, [
    {kind: 'force-insert', position: {x: .5, y: -.25, z: .75}, name: 'A'},
    {kind: 'force-insert', position: {x: -.5, y: .25, z: -.75}, name: 'B'},
  ]);
  const [first, second] = inserted.scenes[0].entities.slice(1);
  assert.notEqual(first.id, second.id);
  const edited = applyNativeDeviceChanges(inserted, sceneId, [
    {kind: 'force-mode', entity_id: first.id, value: 'vortex'},
    {kind: 'parameter', target: address(first.id, 'forces.strength'), value: -3.5},
    {kind: 'parameter', target: address(first.id, 'forces.spin'), value: 2},
    {kind: 'parameter', target: address(first.id, 'forces.radius'), value: .6},
  ]);
  const config = toNativeConfig(edited.scenes[0]);
  const nativeFirst = config.entities.find(value => value.id === first.id), nativeSecond = config.entities.find(value => value.id === second.id);
  assert.deepEqual(nativeFirst.forces, {mode: 'vortex', strength: -3.5, spin: 2, radius: 240});
  assert.equal(nativeFirst.x, 200); assert.equal(nativeFirst.y, -100); assert.equal(nativeFirst.z, 300);
  assert.equal(nativeFirst.share, 0);
  assert.equal(nativeSecond.forces.strength, 1);
  assert.equal(original.scenes[0].entities.length, 1, 'the caller document remains untouched');
});

test('force envelopes preserve state-relative radius, strength and mode', () => {
  const journey = authored(), body = journey.scenes[0].entities[0];
  body.force.strength = 2;
  body.sequence.steps[0].objectState = {size: clone(body.size), rotation: body.rotation, scale: body.scale, tint: body.tint, tintWeight: body.tintWeight, force: {...body.force, strength: 5, radius: .9}};
  const changed = applyNativeDeviceChanges(journey, journey.scenes[0].id, [
    {kind: 'parameter', target: address(body.id, 'forces.strength'), value: 4},
    {kind: 'parameter', target: address(body.id, 'forces.radius'), value: .9},
    {kind: 'force-mode', entity_id: body.id, value: 'repel'},
  ]);
  const state = changed.scenes[0].entities[0].sequence.steps[0].objectState;
  assert.equal(state.force.strength, 7);
  assert.equal(state.force.radius, 1.8);
  assert.equal(state.force.kind, 'repel');
});

test('replacement automation edits offset its real evaluated output and retain the clock', () => {
  const journey = authored(), scene = journey.scenes[0], id = scene.entities[0].id, target = address(id, 'forces.strength');
  scene.automation = [{id: 'force-clock', enabled: true, target, type: 'lfo', wave: 'sine', min: 1, max: 5, rate: .5, phase: 0, blend: 'replace', duration: 4, delay: 0, loop: 'loop', firedAt: null}];
  const actual = evaluate(scene, 0), observed = readNativeDeviceEffectiveValues(scene, {config: actual});
  assert.equal(observed[target], 3, 'observation comes from the production evaluator');
  assert.throws(() => applyNativeDeviceChanges(journey, scene.id, [{kind: 'parameter', target, value: 7}]), /effective automated value/);
  const changed = applyNativeDeviceChanges(journey, scene.id, [{kind: 'parameter', target, value: 7}], observed), nextScene = changed.scenes[0];
  assert.equal(nextScene.automation[0].min, 5); assert.equal(nextScene.automation[0].max, 9);
  assert.equal(nextScene.automation[0].rate, .5); assert.equal(nextScene.automation[0].phase, 0);
  assert.equal(nextScene.entities[0].force.strength, scene.entities[0].force.strength, 'automation offset preserves the authored base');
  assert.equal(readNativeDeviceEffectiveValues(nextScene, {config: evaluate(nextScene, 0)})[target], 7);
});

test('shared field writes affect both Scene projections without duplicating the solver', () => {
  const journey = initialiseShared(authored()), scene = journey.scenes[0];
  const other = clone(scene); other.id = 'another-scene'; journey.scenes.push(other);
  const binding = NATIVE_BINDINGS.find(value => value.path === 'medium.coupling');
  toggleShared(journey, scene, binding.bind);
  const changed = applyNativeDeviceChanges(journey, scene.id, [
    {kind: 'parameter', target: field('medium.coupling'), value: 2.75},
    {kind: 'field-setting', key: 'mediumEnabled', value: true},
    {kind: 'field-setting', key: 'mediumDimension', value: '3D'},
    {kind: 'field-setting', key: 'mediumPlane', value: 'horizontal'},
  ]);
  for (const item of changed.scenes) assert.equal(toNativeConfig(effectiveScene(changed, item)).medium.coupling, 2.75);
  const config = toNativeConfig(effectiveScene(changed, changed.scenes[0]));
  assert.equal(config.medium.enabled, true); assert.equal(config.medium.dimension, '3D'); assert.equal(config.composition.plane, 'horizontal');
  assert.equal(journey.shared.values[binding.bind], binding.defaultValue);
});

test('all enabled Field processors reach the actual production configuration', () => {
  const journey = authored(), scene = journey.scenes[0];
  const changed = applyNativeDeviceChanges(journey, scene.id, [
    {kind: 'field-setting', key: 'resonanceEnabled', value: false},
    {kind: 'field-setting', key: 'collisionEnabled', value: true},
    {kind: 'field-setting', key: 'pairwiseEnabled', value: true},
    {kind: 'field-setting', key: 'collisionMode', value: 'vessel'},
    {kind: 'parameter', target: field('fluid.viscosity'), value: .91},
    {kind: 'parameter', target: field('collision.restitution'), value: .75},
    {kind: 'parameter', target: field('pairwise.restitution'), value: .35},
  ]);
  const config = toNativeConfig(changed.scenes[0]);
  assert.equal(config.fluid.viscosity, .91); assert.equal(config.cymatics.enabled, false);
  assert.equal(config.collision.enabled, true); assert.equal(config.collision.mode, 'vessel'); assert.equal(config.collision.restitution, .75);
  assert.equal(config.pairwise.enabled, true); assert.equal(config.pairwise.restitution, .35);
});

test('native observation follows stable emitter IDs across reordered evaluated config', () => {
  const journey = authored(), sceneId = journey.scenes[0].id;
  const edited = applyNativeDeviceChanges(journey, sceneId, [{kind: 'force-insert', position: {x: 1, y: 2, z: 3}}]);
  const scene = edited.scenes[0], force = scene.entities[1], config = evaluate(scene);
  config.entities.reverse();
  const observed = readNativeDeviceEffectiveValues(scene, {config});
  assert.equal(observed[address(force.id, 'x')], 1); assert.equal(observed[address(force.id, 'z')], 3);
  config.entities.push(clone(config.entities[0]));
  assert.equal(readNativeDeviceEffectiveValues(scene, {config})[address(force.id, 'x')], undefined, 'ambiguous identity is not an observation');
  assert.deepEqual(readNativeDeviceEffectiveValues(scene, null), {});
});

test('invalid batches and locked entities never leak partial edits into the source', () => {
  const journey = authored(), scene = journey.scenes[0], before = clone(journey), id = scene.entities[0].id;
  assert.throws(() => applyNativeDeviceChanges(journey, scene.id, [
    {kind: 'parameter', target: address(id, 'forces.strength'), value: 10},
    {kind: 'parameter', target: address(id, 'forces.radius'), value: NaN},
  ]), /finite/);
  assert.deepEqual(journey, before);
  assert.throws(() => applyNativeDeviceChanges(journey, scene.id, [{kind: 'parameter', target: 'native:__proto__', value: 1}]), /binding/);
  assert.throws(() => applyNativeDeviceChanges(journey, scene.id, [{kind: 'parameter', target: field('medium.gridRes'), value: 64.5}]), /whole number/);
  scene.entities[0].locked = true;
  assert.throws(() => applyNativeDeviceChanges(journey, scene.id, [{kind: 'force-mode', entity_id: id, value: 'vortex'}]), /Unlock/);
});

test('real DocumentStore makes the device batch one undo step and restores native configuration', () => {
  const store = new DocumentStore(authored()), sceneId = store.document.scenes[0].id, id = store.document.scenes[0].entities[0].id;
  const initial = toNativeConfig(store.document.scenes[0]);
  store.change(() => {store.document = applyNativeDeviceChanges(store.document, sceneId, [
    {kind: 'parameter', target: address(id, 'x'), value: 2},
    {kind: 'parameter', target: address(id, 'forces.spin'), value: -4},
  ])});
  assert.equal(store.undoStack.length, 1); assert.equal(toNativeConfig(store.document.scenes[0]).entities[0].x, 800);
  assert.equal(store.undo(), true); assert.deepEqual(toNativeConfig(store.document.scenes[0]), initial);
  assert.equal(store.redo(), true); assert.equal(toNativeConfig(store.document.scenes[0]).entities[0].forces.spin, -4);
});

test('untouched imported values outside slider bounds remain inspectable', () => {
  const journey = authored(), scene = journey.scenes[0], body = scene.entities[0];
  body.position.x = 80; body.force.radius = 80;
  const changed = applyNativeDeviceChanges(journey, scene.id, [{kind: 'parameter', target: address(body.id, 'forces.strength'), value: 2}]);
  assert.equal(changed.scenes[0].entities[0].position.x, 80); assert.equal(changed.scenes[0].entities[0].force.radius, 80);
});
