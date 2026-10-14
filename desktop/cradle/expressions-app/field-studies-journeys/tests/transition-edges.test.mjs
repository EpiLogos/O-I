// lane-5 T5 / T8 and lane-3 E11 (edge facts): per-edge switch mode, per-edge curve, and the loop exit.
// Pure model and transport only; the path panel and the app's frame are source-read by the other guards. Run after
// `npm run build:journeys` (this suite imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldStudies, clone, sceneContentDigest, validateJourney} from '../build/model.js';
import {
  validateTransitionSpec, validateTransitionCurve, transitionSpecFor, curveProgress, switchModeOf,
  writeSeamTransition, seamEdgeSpec, writeLoopExit,
} from '../build/transitions.js';
import {walkJourney, edgeRows, planEdgeEdit, applyEdgeWrite, seamLabel, nativeEdgeRequest, edgeReplyMessage, edgeErrorMessage} from '../build/journeyPath.js';
import {switchHoldsForEnd, switchLanding, advanceSceneTransport} from '../build/sceneTransport.js';
import {expressionTiming} from '../build/propertyTracks.js';

const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} vs ${expected}`);
const smoothstep = u => u * u * (3 - 2 * u);

test('absent edge facts are today\'s behaviour: no curve, immediate switch, crossfade by absence, the same label', () => {
  assert.equal(validateTransitionSpec({kind: 'crossfade'}), undefined);
  assert.equal(validateTransitionSpec({kind: 'crossfade', switchMode: 'immediate'}), undefined, 'immediate is the default, not written');
  assert.equal(validateTransitionCurve({type: 'linear'}), undefined, 'a linear curve is the default, not written');
  assert.equal(seamLabel(undefined, 1.5), 'Crossfade · 1.5 s');
  assert.equal(seamLabel({kind: 'cut'}, 3), 'Cut');
  assert.equal(switchModeOf(undefined), 'immediate');
  for (const f of [-1, 0, .1, .25, .5, .75, .999, 1, 2]) {
    assert.equal(curveProgress(undefined, f), Math.min(1, Math.max(0, f)), `absent curve is the identity at ${f}`);
  }
  assert.equal(switchLanding(undefined, 5, 10), 0, 'an absent switch enters at the Scene start, as before');
  assert.equal(switchHoldsForEnd(undefined, false, true), false, 'an absent switch never holds a jump');
});

test('the switch mode is named, bounded to its three values, and immediate normalises away', () => {
  assert.deepEqual(validateTransitionSpec({kind: 'dip-to-colour', at: .5, switchMode: 'sync'}), {kind: 'dip-to-colour', at: .5, switchMode: 'sync'});
  assert.deepEqual(validateTransitionSpec({kind: 'cut', switchMode: 'at-end'}), {kind: 'cut', switchMode: 'at-end'}, 'a cut lands when its switch says');
  assert.deepEqual(validateTransitionSpec({kind: 'wipe', direction: 'up', switchMode: 'immediate'}), {kind: 'wipe', direction: 'up'});
  assert.throws(() => validateTransitionSpec({kind: 'crossfade', switchMode: 'later'}), /Unknown switch mode "later"\. Choose immediate, sync or at-end\./);
  assert.throws(() => validateTransitionSpec({kind: 'crossfade', switchMode: 3}), /Unknown switch mode/);
});

test('a crossfade that carries an edge fact is kept; a crossfade with none is still the default', () => {
  assert.deepEqual(validateTransitionSpec({kind: 'crossfade', switchMode: 'at-end'}), {kind: 'crossfade', switchMode: 'at-end'});
  assert.deepEqual(transitionSpecFor('crossfade', {switchMode: 'sync'}), {kind: 'crossfade', switchMode: 'sync'});
  assert.equal(transitionSpecFor('crossfade', {}), undefined);
});

test('a curve is one of the E08 types by name; a cut takes no curve; handles belong to a bezier only', () => {
  assert.throws(() => validateTransitionCurve({type: 'ease-in'}), /Unknown transition curve "ease-in"\. Choose linear, hold, smooth or bezier\./);
  assert.throws(() => validateTransitionSpec({kind: 'cut', curve: {type: 'smooth'}}), /Transition cut takes no curve parameter\./);
  assert.throws(() => validateTransitionCurve({type: 'smooth', out: {dt: .2, dv: 0}}), /Only a bezier curve takes handles\./);
  assert.deepEqual(validateTransitionSpec({kind: 'crossfade', curve: {type: 'smooth'}}), {kind: 'crossfade', curve: {type: 'smooth'}});
});

test('bezier handles are validated as E08 validates them: time inside the segment, value inside the channel range', () => {
  assert.throws(() => validateTransitionCurve({type: 'bezier', out: {dt: 1.5, dv: 0}}), /Handle time must stay inside its segment/);
  assert.throws(() => validateTransitionCurve({type: 'bezier', in: {dt: .2, dv: 0}}), /Handle time must stay inside its segment/);
  assert.throws(() => validateTransitionCurve({type: 'bezier', out: {dt: .3, dv: 2}}), /Handle value is outside the channel range \(0 to 1\)/);
  assert.throws(() => validateTransitionCurve({type: 'bezier', out: {dt: NaN, dv: 0}}), /Invalid property keyframe handle/);
  const kept = validateTransitionCurve({type: 'bezier', out: {dt: .3, dv: .1}, in: {dt: -.3, dv: -.1}});
  assert.deepEqual(kept, {type: 'bezier', out: {dt: .3, dv: .1}, in: {dt: -.3, dv: -.1}});
});

test('curves evaluate through the E08 segment law: hold waits, smooth is smoothstep, handle-less bezier is linear', () => {
  assert.equal(curveProgress({type: 'hold'}, .5), 0, 'hold stays at the outgoing until the end');
  assert.equal(curveProgress({type: 'hold'}, 1), 1);
  near(curveProgress({type: 'smooth'}, .25), smoothstep(.25), 'smooth at .25');
  near(curveProgress({type: 'smooth'}, .75), smoothstep(.75), 'smooth at .75');
  near(curveProgress({type: 'bezier'}, .4), .4, 'a handle-less bezier is linear');
  const ease = {type: 'bezier', out: {dt: .5, dv: 0}, in: {dt: -.5, dv: 0}};
  near(curveProgress(ease, 0), 0, 'bezier starts at 0');
  near(curveProgress(ease, 1), 1, 'bezier ends at 1');
  let prev = -1;
  for (let i = 0; i <= 50; i++) {
    const v = curveProgress(ease, i / 50);
    assert.ok(v >= prev - 1e-12, 'a monotone curve never runs backwards');
    prev = v;
  }
  near(curveProgress(ease, .5), .5, 'symmetric handles pass through the middle');
});

test('the switch resolves at its own point: sync carries the outgoing position, at-end holds a jump to the outgoing end', () => {
  const sync = {kind: 'crossfade', switchMode: 'sync'}, atEnd = {kind: 'crossfade', switchMode: 'at-end'};
  assert.equal(switchLanding(sync, 4.5, 10), 4.5, 'sync enters where the outgoing stands');
  assert.ok(switchLanding(sync, 40, 10) < 10, 'sync never lands at or past the end');
  assert.equal(switchLanding(atEnd, 4.5, 10), 0, 'at-end lands at the Scene start once held');
  assert.equal(switchHoldsForEnd(atEnd, false, true), true, 'a jump while playing waits for the natural end');
  assert.equal(switchHoldsForEnd(atEnd, true, true), false, 'the automatic advance at an end is never held');
  assert.equal(switchHoldsForEnd(atEnd, false, false), false, 'paused playback has no outgoing run to wait for');
  assert.equal(switchHoldsForEnd(sync, false, true), false, 'sync does not hold');
});

test('the timeline write keeps a seam\'s edge facts when its kind or seconds change, and drops a curve with a cut', () => {
  const scenes = [{id: 'a', transition: 0}, {id: 'b', transition: 1, transitionSpec: {kind: 'crossfade', switchMode: 'sync', curve: {type: 'smooth'}}}];
  writeSeamTransition(scenes, 'b', undefined, 2);
  assert.deepEqual(scenes[1].transitionSpec, {kind: 'crossfade', switchMode: 'sync', curve: {type: 'smooth'}}, 'seconds edit keeps the facts');
  assert.equal(scenes[1].transition, 2);
  writeSeamTransition(scenes, 'b', {kind: 'wipe', direction: 'left'}, 2);
  assert.deepEqual(scenes[1].transitionSpec, {kind: 'wipe', direction: 'left', switchMode: 'sync', curve: {type: 'smooth'}}, 'a kind change keeps the facts');
  writeSeamTransition(scenes, 'b', {kind: 'cut'}, 0);
  assert.deepEqual(scenes[1].transitionSpec, {kind: 'cut', switchMode: 'sync'}, 'a cut keeps its switch and takes no curve');
});

test('an edge edit replaces its own fact and returns to the default when set back', () => {
  const current = {kind: 'crossfade', switchMode: 'sync', curve: {type: 'smooth'}};
  assert.deepEqual(seamEdgeSpec(current, {switchMode: 'at-end'}), {kind: 'crossfade', switchMode: 'at-end', curve: {type: 'smooth'}});
  assert.deepEqual(seamEdgeSpec(current, {curve: undefined}), {kind: 'crossfade', switchMode: 'sync'});
  assert.equal(seamEdgeSpec(current, {switchMode: 'immediate', curve: undefined}), undefined, 'all defaults is no spec');
});

test('an edge edit plans one labelled write, applied to the Scene it names; each refusal is named', () => {
  const journey = {scenes: [{id: 'a', name: 'A', duration: 4, transition: 0}, {id: 'b', name: 'B', duration: 4, transition: 1}], loop: true};
  const local = planEdgeEdit(journey, {kind: 'switch', enterSceneId: 'b', mode: 'at-end'});
  assert.equal(local.ok, true);
  assert.equal(local.label, 'Set transition switch at end');
  applyEdgeWrite(journey.scenes, local.write);
  assert.deepEqual(journey.scenes[1].transitionSpec, {kind: 'crossfade', switchMode: 'at-end'});
  assert.equal(planEdgeEdit(journey, {kind: 'curve', enterSceneId: 'b', type: 'linear'}).ok, true, 'linear clears the curve');
  assert.equal(planEdgeEdit(journey, {kind: 'curve', enterSceneId: 'a', type: 'hold'}).ok, true, 'a curve may enter the first Scene (the loop wrap)');
  assert.deepEqual(planEdgeEdit(journey, {kind: 'curve', enterSceneId: 'b', type: 'ease-in'}), {ok: false, reason: 'Unknown transition curve "ease-in". Choose linear, hold, smooth or bezier.'});
  assert.deepEqual(planEdgeEdit(journey, {kind: 'loop', exitSceneId: 'zz', on: true}), {ok: false, reason: 'That scene is no longer in this expression.'});
});

// The hosted journey's edge edit is one native edit: the Scene's own authored material from the owner, the edge applied to a copy,
// one scene_material_set on the captured revision. The owner's refusal is shown by name.
const nativeView = (presentation, revision = 7) => ({
  expression: {expression_ref: 'expression:j', revision, scenes: [
    {scene_ref: 'scene:a', presentation: null},
    {scene_ref: 'scene:b', presentation: {schema: 'oi.journey-scene/v1', scene: presentation, saved: null}},
  ]},
  bindings: {a: {scene_ref: 'scene:a'}, b: {scene_ref: 'scene:b'}},
});
const authoredB = {id: 'b', name: 'B', duration: 4, transition: 1, character: 'x', view: {mode: '2d'}, field: {background: '#fff'}};

test('a hosted switch edit reaches the native edit as one scene_material_set on the captured revision, with the new fields', () => {
  const routed = nativeEdgeRequest(nativeView(authoredB), {kind: 'switch', enterSceneId: 'b', mode: 'sync'});
  assert.equal(routed.ok, true);
  assert.equal(routed.label, 'Set transition switch sync');
  const {request} = routed;
  assert.equal(request.operation, 'edit');
  assert.equal(request.expression_ref, 'expression:j');
  assert.equal(request.expected_revision, 7, 'the edit is taken on the revision the owner holds');
  assert.equal(request.changes.length, 1, 'one change: one composite');
  const change = request.changes[0];
  assert.equal(change.change, 'scene_material_set');
  assert.equal(change.scene_ref, 'scene:b');
  assert.equal(change.presentation.schema, 'oi.journey-scene/v1');
  assert.deepEqual(change.presentation.scene.transitionSpec, {kind: 'crossfade', switchMode: 'sync'}, 'the new field travels');
  assert.equal(change.presentation.scene.character, 'x', 'the rest of the authored material is carried whole');
  assert.equal(change.presentation.scene.transition, 1);
  assert.equal(authoredB.transitionSpec, undefined, 'the owner\'s own reading is not mutated');
});

test('a hosted loop exit reaches the native edit as the last Scene\'s own flag', () => {
  const routed = nativeEdgeRequest(nativeView(authoredB), {kind: 'loop', exitSceneId: 'b', on: true});
  assert.equal(routed.ok, true);
  assert.equal(routed.label, 'Set loop exit at end');
  assert.equal(routed.request.changes[0].presentation.scene.breakAtEnd, true);
  assert.equal(nativeEdgeRequest(nativeView(authoredB), {kind: 'loop', exitSceneId: 'zz', on: true}).ok, false, 'an unbound Scene is refused');
});

test('the owner\'s refusal is shown by name, and a conflict says nothing was written', () => {
  const label = 'Set transition switch sync';
  assert.deepEqual(edgeReplyMessage({state: 'ready'}, label), {ok: true, text: 'Set transition switch sync: saved.'});
  assert.deepEqual(edgeReplyMessage({state: 'revision_conflict', current_revision: 9}, label),
    {ok: false, text: 'Set transition switch sync was not written: this Expression changed elsewhere (now revision 9). Refresh and try again.'});
  assert.deepEqual(edgeReplyMessage({state: 'refused', error: 'Unknown Scene transition switch mode "later". Choose immediate, sync or at-end.'}, label),
    {ok: false, text: 'Set transition switch sync was refused by the native owner: Unknown Scene transition switch mode "later". Choose immediate, sync or at-end.'});
  assert.equal(edgeErrorMessage(label, 'Scene transition cut takes no curve parameter'),
    'Set transition switch sync was refused by the native owner: Scene transition cut takes no curve parameter');
});

test('the loop exit is a Scene flag: validated as a boolean, absent when off, and a timeline fact outside the content digest', () => {
  const journey = validateJourney(clone(fieldStudies()));
  assert.equal(JSON.stringify(validateJourney(clone(journey))), JSON.stringify(journey), 'no edge facts: bytes unchanged');
  const scene = clone(journey.scenes[0]);
  const digest = sceneContentDigest(scene);
  const exiting = {...scene, breakAtEnd: true};
  assert.equal(sceneContentDigest(exiting), digest, 'the loop exit is a timeline fact');
  const withExit = validateJourney({...clone(journey), scenes: [exiting, ...journey.scenes.slice(1)]});
  assert.equal(withExit.scenes[0].breakAtEnd, true);
  const cleared = validateJourney({...clone(journey), scenes: [{...scene, breakAtEnd: false}, ...journey.scenes.slice(1)]});
  assert.equal('breakAtEnd' in cleared.scenes[0], false, 'off is absent');
  assert.throws(() => validateJourney({...clone(journey), scenes: [{...scene, breakAtEnd: 'yes'}, ...journey.scenes.slice(1)]}), /A loop exit is on or off\./);
  const scenes = clone(journey.scenes);
  writeLoopExit(scenes, scenes[0].id, true);
  assert.equal(scenes[0].breakAtEnd, true);
  writeLoopExit(scenes, scenes[0].id, false);
  assert.equal('breakAtEnd' in scenes[0], false);
});

test('the path names where playback stops: the loop exit on the last Scene, and no wrap from it', () => {
  const base = {loop: true, scenes: [
    {id: 'a', name: 'A', duration: 4, transition: 0},
    {id: 'b', name: 'B', duration: 4, transition: 1},
    {id: 'c', name: 'C', duration: 4, transition: 1, breakAtEnd: true},
  ]};
  const timing = (index, local) => expressionTiming(base, index, local);
  const end = walkJourney(base, timing, 11);
  assert.equal(end.stop?.name, 'C', 'the stop is the named last Scene');
  assert.equal(end.next, null, 'no next Scene past a loop exit');
  const plain = walkJourney({...base, scenes: base.scenes.map(({breakAtEnd, ...s}) => s)}, timing, 11);
  assert.equal(plain.stop, null, 'without an exit there is no stop');
  assert.deepEqual(plain.next, {index: 0, name: 'A', wraps: true}, 'the journey wraps as it always did');
  const unlooped = walkJourney({...base, loop: false}, timing, 11);
  assert.equal(unlooped.stop, null, 'a journey that does not loop has no loop exit to show');
});

test('the edge rows put each parameter on the edge it moves: the seam into a Scene, and the loop wrap with its exit', () => {
  const journey = {loop: true, scenes: [
    {id: 'a', name: 'A', duration: 4, transition: 0, transitionSpec: {kind: 'crossfade', curve: {type: 'hold'}}},
    {id: 'b', name: 'B', duration: 4, transition: 1, transitionSpec: {kind: 'crossfade', switchMode: 'sync'}},
    {id: 'c', name: 'C', duration: 4, transition: 1, breakAtEnd: true},
  ]};
  const rows = edgeRows(journey);
  assert.deepEqual(rows.map(r => [r.kind, r.enterSceneId, r.exitSceneId]), [['seam', 'b', null], ['seam', 'c', null], ['loop', 'a', 'c']]);
  assert.equal(rows[0].switchMode, 'sync');
  assert.equal(rows[2].curve, 'hold', 'the wrap carries the first Scene\'s curve');
  assert.equal(rows[2].breakAtEnd, true, 'and the last Scene\'s loop exit');
  assert.deepEqual(edgeRows({...journey, loop: false}).map(r => r.kind), ['seam', 'seam'], 'no loop row without a loop');
});

test('a saved sequence stops at a loop exit on its last Scene, and wraps everywhere else exactly as before', () => {
  const scenes = [
    {id: 'a', name: 'A', duration: 10, transition: 0},
    {id: 'b', name: 'B', duration: 4, transition: 0},
    {id: 'c', name: 'C', duration: 6, transition: 0},
  ];
  const savedScenes = {a: {id: 'a', duration: 10}, b: {id: 'b', duration: 4}, c: {id: 'c', duration: 6}};
  const common = {playing: true, libraryOpen: false, hidden: false, propertyRecording: false, editing: false, savedSequence: true};
  const looped = {schema: 'oi.journey', version: 1, id: 'j', name: 'j', description: '', loop: true, updatedAt: '', scenes, savedScenes};
  const wraps = advanceSceneTransport(looped, 2, 5.9, .25, common);
  assert.equal(wraps.advance_to_scene_index, 0, 'without an exit the last Scene wraps to the first');
  const exiting = {...looped, scenes: scenes.map((s, i) => i === 2 ? {...s, breakAtEnd: true} : s)};
  const stopped = advanceSceneTransport(exiting, 2, 5.9, .25, common);
  assert.equal(stopped.completed, true, 'the loop exit stops playback at the end of the named Scene');
  assert.equal(stopped.advance_to_scene_index, null, 'and does not wrap');
  assert.equal(stopped.saved_sequence_playing, false);
  const middle = advanceSceneTransport({...exiting, scenes: scenes.map((s, i) => i === 1 ? {...s, breakAtEnd: true} : s)}, 1, 3.9, .25, common);
  assert.equal(middle.advance_to_scene_index, 2, 'a loop exit mid-sequence does not stop the advance to the next Scene');
});
