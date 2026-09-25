/**
 * G2/G3/G4 (techne-inheritance-restoration, owner commission M1 geometry):
 * proves the exact native Blueprint edit law in nativeBlueprint.ts +
 * blueprintGeometry.ts — a whole transform is ONE native edit
 * (scene_blueprint_transform), release is a distinct act that never touches
 * membership, and no third "move one role" path exists: any attempt that is
 * not the canonical bind/transform/release trio still funnels through the
 * same validated-binding gate rather than landing as a silent partial edit.
 *
 * Imports the already-built module (matches this suite's own convention —
 * see kernel-document-bridge.test.mjs); run `npm run build` first if the
 * build/ directory is stale relative to src/.
 *
 * Run: node --test tests/blueprint-whole.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBlueprintEdit} from '../build/nativeBlueprint.js';
import {BLUEPRINT_SHAPE, BLUEPRINT_READING_DIGEST} from '../build/blueprintGeometry.js';

const E = 'expression:blueprint-fixture', S = E + ':scene:main';
const FRAME = {ref: 'wiki:frame:test', revision: 'r1', availability: 'available'};
const A = E + ':entity:a', B = E + ':entity:b';

function binding(transform) {
  return {
    schema: 'oi.scene-blueprint/v1',
    shape_ref: BLUEPRINT_SHAPE,
    reading_digest: BLUEPRINT_READING_DIGEST,
    frame: FRAME,
    members: [
      {entity_ref: A, subject_ref: 'wiki:node:a', role_ref: 'role:a', position: 0},
      {entity_ref: B, subject_ref: 'wiki:node:b', role_ref: 'role:b', position: 1},
    ],
    transform,
  };
}
const IDENTITY = {translation: [0, 0, 0], rotation: [0, 0, 0], scale: 1};

function entity(ref, subjectRef) {
  return {
    entity_ref: ref, revision: 1, title: ref,
    subject: {subject_ref: subjectRef, readings: [FRAME]},
    parameters: {x: {value: 0, automation: null}, y: {value: 0, automation: null}, z: {value: 0, automation: null}},
  };
}
function document(existingBinding) {
  const entities = {[A]: entity(A, 'wiki:node:a'), [B]: entity(B, 'wiki:node:b')};
  const scene = {
    scene_ref: S, revision: 1, title: 'Main', entity_refs: Object.keys(entities),
    presentation: existingBinding
      ? {
          schema: 'oi.journey-scene/v1',
          scene: {
            entities: [{id: A, position: {x: 0, y: -0.25, z: 0}}, {id: B, position: {x: 0.2165, y: 0.125, z: 0}}],
            composition: {blueprint: existingBinding},
          },
        }
      : undefined,
  };
  return {schema: 'oi.expression/v1', expression_ref: E, revision: 1, title: 't', entities, scenes: [scene]};
}
function view(existingBinding) {
  const doc = document(existingBinding);
  return {document: doc};
}

test('a whole transform is exactly ONE native edit: scene_blueprint_transform, nothing else', () => {
  const {request} = prepareBlueprintEdit(view(binding(IDENTITY)), {
    expression_ref: E, revision: 1, scene_ref: S, operation: 'transform',
    transform: {translation: [10, 20, 30], rotation: [0, 0, 0], scale: 1.5},
  });
  assert.equal(request.changes.length, 1);
  assert.equal(request.changes[0].change, 'scene_blueprint_transform');
  assert.equal(request.changes[0].scene_ref, S);
});

test('a whole transform changes only the transform field — membership (entity/subject/role/position) is byte-identical after', () => {
  const before = binding(IDENTITY);
  const {expected} = prepareBlueprintEdit(view(before), {
    expression_ref: E, revision: 1, scene_ref: S, operation: 'transform',
    transform: {translation: [5, 0, 0], rotation: [0, 0.2, 0], scale: 2},
  });
  const after = expected.scenes[0].presentation.scene.composition.blueprint;
  assert.deepEqual(after.members, before.members, 'transform must never touch members/roles/positions');
  assert.notDeepEqual(after.transform, before.transform, 'the transform itself must actually change');
});

test('release is a DISTINCT act from transform: it removes the blueprint and is its own single change, never a transform', () => {
  const {request, expected} = prepareBlueprintEdit(view(binding(IDENTITY)), {
    expression_ref: E, revision: 1, scene_ref: S, operation: 'release',
  });
  assert.equal(request.changes.length, 1);
  assert.equal(request.changes[0].change, 'scene_blueprint_release');
  assert.equal(expected.scenes[0].presentation.scene.composition.blueprint, undefined, 'release actually clears the binding');
});

test('there is no fourth "move one role" operation: anything outside bind/transform/release still funnels through the validated whole-binding gate and refuses rather than landing a silent partial edit', () => {
  assert.throws(
    () => prepareBlueprintEdit(view(binding(IDENTITY)), {expression_ref: E, revision: 1, scene_ref: S, operation: 'move-one-role'}),
    /sixfold presentation|transform/,
  );
});

test('binding a shape that is not the exact pinned owner reading is refused outright — no substitute ring, no partial acceptance', () => {
  const wrongShape = {...binding(IDENTITY), shape_ref: 'ql:shape:1.0.0:constellation:fourfold'};
  assert.throws(
    () => prepareBlueprintEdit(view(undefined), {expression_ref: E, revision: 1, scene_ref: S, operation: 'bind', binding: wrongShape}),
    /sixfold presentation/,
  );
});
