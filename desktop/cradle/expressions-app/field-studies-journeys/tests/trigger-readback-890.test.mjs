// O-I #747 round 890, the walk's finding on XS07 (Jump set from Clip view): the owner attached the scene's "Scene leaves → Jump to a scene"
// trigger, and the frame refused its own acknowledgement ("Native connection acknowledgement differs from the captured edit"), so the
// Clip view kept reading Next scene at the old revision. The frame predicts what the owner keeps (nativeWorking.ts connectionResult), and
// the owner keeps a trigger target as serde writes it (kernel expression_trigger.rs TriggerTarget): an absent `Option` field is written
// null, so a Navigate target carries `scene_ref` and `entity_ref`, and a Portal target its `scene_ref`, null where the edit named none.
// The prediction must be the owner's, or every jump the Clip view or the Scene's trigger editor sets is refused after it landed.
// FIXTURE: the frame's own NativeWorking over an owner that keeps a trigger exactly as the kernel serialises it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NativeWorking} from '../build/nativeWorking.js';
import {blankScene} from '../build/model.js';

const E = 'expression:jump-890';
const S = n => `${E}:scene:s${n}`;
const clone = value => JSON.parse(JSON.stringify(value));
function head() {
  const scenes = ['Dawn', 'Noon', 'Dusk'].map((name, i) => {
    const scene = blankScene(name); scene.id = S(i + 1); scene.duration = 6; scene.transition = 1;
    return {scene_ref: scene.id, revision: 1, title: name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  return {schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Jump', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []};
}
// What the kernel writes for a target (expression_trigger.rs: `#[serde(default)] scene_ref: Option<String>`, no skip_serializing_if).
const kept = target => target.kind === 'navigate' ? {kind: 'navigate', scene_ref: target.scene_ref ?? null, entity_ref: target.entity_ref ?? null}
  : target.kind === 'portal' ? {...target, scene_ref: target.scene_ref ?? null} : target;
function owner() {
  const own = {doc: head(), edits: []};
  own.port = async request => {
    if (request.operation === 'inspect') return {state: 'ready', document: clone(own.doc)};
    assert.equal(request.operation, 'edit');
    own.edits.push(clone(request));
    const next = clone(own.doc), touched = new Set();
    for (const change of request.changes) {
      if (change.change === 'scene_trigger_attach') {
        const scene = next.scenes.find(row => row.scene_ref === change.scene_ref);
        scene.triggers = [...(scene.triggers ?? []), {trigger_ref: change.trigger.trigger_ref, occasion: change.trigger.occasion, target: kept(change.trigger.target)}];
        touched.add(scene.scene_ref);
      } else if (change.change === 'scene_trigger_detach') {
        for (const scene of next.scenes) if ((scene.triggers ?? []).some(row => row.trigger_ref === change.trigger_ref)) {
          scene.triggers = scene.triggers.filter(row => row.trigger_ref !== change.trigger_ref); touched.add(scene.scene_ref)
        }
      } else assert.fail(`unexpected change ${change.change}`);
    }
    next.revision += 1;
    for (const scene of next.scenes) if (touched.has(scene.scene_ref)) scene.revision = next.revision;
    own.doc = next;
    return {state: 'ready', document: clone(next)};
  };
  return own;
}
const working = own => new NativeWorking({mint: () => 'expression:unused', checkpoint: async () => {}, file: async () => assert.fail('no file owner'), expression: own.port});

test('XS07 (walk 890): a Jump to a scene lands, and the frame takes the owner\'s acknowledgement of it', async () => {
  const own = owner(), work = working(own);
  await work.adopt(clone(own.doc));
  const jump = {trigger_ref: `${E}:trigger:jump-1`, occasion: 'scene_leave', target: {kind: 'navigate', scene_ref: S(3)}};
  const view = await work.editConnections([{change: 'scene_trigger_attach', scene_ref: S(1), trigger: jump}]);
  assert.equal(view.document.revision, 5);
  assert.deepEqual(view.document.scenes[0].triggers, [{trigger_ref: jump.trigger_ref, occasion: 'scene_leave', target: {kind: 'navigate', scene_ref: S(3), entity_ref: null}}]);
  assert.equal(work.state.pending, undefined, 'nothing is left pending: the edit is the owner\'s');
  // and taken off again, the scene leaves to the next as before
  const back = await work.editConnections([{change: 'scene_trigger_detach', trigger_ref: jump.trigger_ref}]);
  assert.deepEqual(back.document.scenes[0].triggers, []);
});

test('XS07 (walk 890): a Portal trigger with no scene is the owner\'s too: its scene_ref kept null', async () => {
  const own = owner(), work = working(own);
  await work.adopt(clone(own.doc));
  const portal = {trigger_ref: `${E}:trigger:look`, occasion: 'scene_enter', target: {kind: 'portal', placement: 'beside', subject_ref: 'wiki:page:sky'}};
  const view = await work.editConnections([{change: 'scene_trigger_attach', scene_ref: S(2), trigger: portal}]).catch(error => error);
  if (view instanceof Error) assert.doesNotMatch(view.message, /acknowledgement differs/, 'never refused for the owner\'s own null');
  else assert.equal(view.document.scenes[1].triggers[0].target.scene_ref, null);
});

test('the prediction follows the kernel\'s own serialisation: Navigate and Portal keep their Option fields, written null', () => {
  const rust = readFileSync(new URL('../../../kernel/src/expression_trigger.rs', import.meta.url), 'utf8');
  const navigate = rust.slice(rust.indexOf('    Navigate {'), rust.indexOf('}', rust.indexOf('    Navigate {')));
  assert.match(navigate, /scene_ref: Option<String>/);
  assert.doesNotMatch(navigate, /skip_serializing_if/, 'were the kernel to skip absent fields, the frame\'s prediction would follow it');
});
