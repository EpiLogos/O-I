/** Resolve actual retained work through the existing registry/converters.
 * No native writes, fixtures, synthetic parameter metadata or editor claim. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {kernelOp} from '../../../desktop/cradle/src/kernel/bridge.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {PARAM_REGISTRY, NATIVE_BINDINGS, WORLD_SCALE, entityTargets, automationTarget, stableNativeTarget} from '../src/parameters.ts';
const flag = process.argv.indexOf('--kernel-url');
if (flag < 0 || !process.argv[flag + 1]) throw Error('Pass --kernel-url with the explicit running native owner');
const transport = {kind: 'bridge', url: process.argv[flag + 1]};
const expression_ref = 'expression:authored-acb9d00d-e7e4-4f2f-948f-395914da17b1';
const result = await kernelOp(transport, {op: 'expression', request: {operation: 'inspect', expression_ref}});
assert.equal(result.error, undefined, result.error);
assert.equal(result.outcome?.result, 'expression');
const document = result.outcome.data.document;
assert.equal(document?.expression_ref, expression_ref);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const original = hash(document), conversion = kernelDocumentToJourney(document);
const scene = conversion.journey.scenes[0];
assert.ok(scene?.entities.length > 0, 'The genuine retained authored work must disclose its entities');
assert.equal(NATIVE_BINDINGS.length, PARAM_REGISTRY.length);
for (const binding of NATIVE_BINDINGS) {
  const definition = PARAM_REGISTRY.find(row => row.path === binding.path);
  assert.equal(binding.min, definition.min / binding.factor);
  assert.equal(binding.hardMax, definition.hardMax / binding.factor);
  assert.equal(binding.step, definition.step / binding.factor);
}
const targets = entityTargets(scene);
assert.ok(targets.length > 0);
// These are the actual occurrences of the retained work, rather than
// constructed registry fixtures. Scene material owns occurrence positions
// and force settings; an entity scalar, when present, owns native pixels.
const nativeParameters = {x: 'x', y: 'y', z: 'z', 'forces.radius': 'force_radius'};
const nativeScene = document.scenes.find(row => row.scene_ref === conversion.bindings[scene.id].scene_ref);
let spatialTargets = 0;
for (const target of targets) {
  const nativeParameter = nativeParameters[target.key];
  if (!nativeParameter) continue;
  const entityRef = conversion.bindings[scene.id].occurrences.find(row => row.view_entity_id === target.entityId)?.entity_ref;
  const material = nativeScene.presentation?.scene.entities.find(row => row.id === entityRef);
  const retainedValue = target.key === 'forces.radius' ? material?.force.radius : material?.position[target.key];
  const nativeValue = document.entities[entityRef]?.parameters?.[nativeParameter]?.value;
  if (material) {
    assert.equal(typeof retainedValue, 'number', 'The retained Scene supplies its owned spatial value');
    assert.equal(target.value, retainedValue, 'The adapter preserves the owned Scene occurrence value');
  } else {
    assert.equal(typeof nativeValue, 'number', 'The retained work supplies the owned native spatial parameter');
    assert.ok(Math.abs(target.value * WORLD_SCALE - nativeValue) < 1e-9, 'The displayed spatial value round-trips to the native owner');
  }
  assert.equal(target.unit, 'stage units', 'A converted stage value must not be labelled as native pixels');
  spatialTargets++;
}
assert.ok(spatialTargets > 0, 'The real work exercised spatial parameter conversion');
const reordered = structuredClone(scene);
reordered.entities.reverse();
for (const target of targets) {
  assert.equal(stableNativeTarget(scene, target.path), target.target);
  const reread = automationTarget(reordered, target.target);
  assert.equal(reread?.entityId, target.entityId);
  assert.equal(reread?.value, target.value, 'A stable target resolves the same owned entity after view-order changes');
  if (/\.([xyz]|forces\.radius)$/.test(target.path)) assert.equal(target.factor, WORLD_SCALE);
}
assert.equal(hash(document), original);
console.log(JSON.stringify({grade: 'B', kernel_url: transport.url, passed: 4, faults: 0,
  claim: 'canonical parameter definitions/conversions and stable target resolution on real retained authored work; no editor/save claim',
  expression_ref, revision: document.revision, entity_targets: targets.length, spatial_targets: spatialTargets, field_definitions: NATIVE_BINDINGS.length,
  document_sha256: original}));
