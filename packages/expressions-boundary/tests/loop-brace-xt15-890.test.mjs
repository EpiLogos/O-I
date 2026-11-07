/** O-I #747 round 890, XT15 ("I loop the scenes while I watch the cut"; DLW.md §16.6, "A loop region has an in point and an out point: the
 * transport plays, and repeats, only between them"; §20.2 Transport, Loop): the in and out points are set from the shell as Live's loop
 * brace is set, by dragging its ends. A brace end let go is one owner act, `loop-edge`, which moves that edge by the frame's own drag law
 * (journeyMarkers.ts dragLoopEdge: inside the sequence, the far edge held by the loop's least length) and is carried, as the loop flag is,
 * by composition_set. With no region kept, the brace is the whole sequence's and the edge moved makes one. Real authoring model, real
 * composition owner; nothing is stubbed but the native acknowledgement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeSceneEdit} from '../src/sceneEdits.ts';
import {projectNativeScenes} from '../src/scenes.ts';
import * as model from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {dragLoopEdge, LOOP_MIN_SECONDS} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/journeyMarkers.ts';

const {blankScene, clone} = model;
const E = 'expression:brace';
const S = n => `${E}:scene:s${n}`;
/** Three native Scenes of 10, 8 and 12 s (30 s), the first selected; `properties` the Expression's own. */
function seed(properties = null) {
  const scenes = [10, 8, 12].map((duration, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Brace', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: [],
    ...(properties ? {presentation: {schema: 'oi.journey-properties/v1', description: '', loop: true, ...properties}} : {})});
}
const edge = (view, intent) => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'loop-edge', ...intent});

test('XT15 (round 890): a brace end let go moves that edge, one labelled owner act carried by composition_set', () => {
  const view = seed({loopRegion: {from: 4, to: 12}});
  const out = edge(view, {edge: 'to', at: 20.004});
  assert.equal(out.label, 'Set loop out');
  assert.deepEqual(out.snapshot.journey.loopRegion, {from: 4, to: 20});
  const set = out.request.changes.filter(change => change.change === 'composition_set');
  assert.equal(set.length, 1); assert.deepEqual(set[0].presentation.loopRegion, {from: 4, to: 20});
  assert.equal(out.request.changes.some(change => change.change === 'scene_material_set'), false, 'no scene is touched');
  const into = edge(view, {edge: 'from', at: 2.5});
  assert.equal(into.label, 'Set loop in');
  assert.deepEqual(into.snapshot.journey.loopRegion, {from: 2.5, to: 12});
});

test('XT15 (round 890): the edge moves by the frame\'s own drag law: inside the sequence, never past the far edge', () => {
  const view = seed({loopRegion: {from: 4, to: 12}});
  for (const [which, at] of [['to', 99], ['from', -3], ['from', 30], ['to', 0], ['to', 4.2]])
    assert.deepEqual(edge(view, {edge: which, at}).snapshot.journey.loopRegion, dragLoopEdge({from: 4, to: 12}, which, at, 30), `${which} at ${at}`);
  assert.deepEqual(edge(view, {edge: 'from', at: 30}).snapshot.journey.loopRegion, {from: 12 - LOOP_MIN_SECONDS, to: 12}, 'held by the least length');
});

test('XT15 (round 890): with no region kept the brace is the whole sequence\'s; moving one end makes a region, read back as the scenes reading\'s', () => {
  const view = seed();
  const out = edge(view, {edge: 'to', at: 18});
  assert.deepEqual(out.snapshot.journey.loopRegion, {from: 0, to: 18});
  const kept = seed({loopRegion: out.snapshot.journey.loopRegion});
  assert.deepEqual(projectNativeScenes(kept.journey, kept).loop_region, {from: 0, to: 18});
});

test('XT15 (round 890): an edge is named in or out and set at a second; anything else is refused before the owner is asked', () => {
  const view = seed({loopRegion: {from: 4, to: 12}});
  for (const intent of [{edge: 'body', at: 3}, {edge: 'to'}, {edge: 'to', at: '9'}, {edge: 'to', at: NaN}])
    assert.throws(() => edge(view, intent), /A loop edge is its in or out, set at a second/, JSON.stringify(intent));
});
