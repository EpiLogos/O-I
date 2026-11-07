/** O-I #747 round 884, XS08 ("I set when scenes launch"), ruled from the manual (DLW build ruling 2026-11-06): the transport's Quantize
 * for Expressions is "Set when scenes launch" (DLW.md §10.5); a scene's Quantize is "Global, or one of the transport's values … Global
 * follows the transport's Quantize" (§20.1 The Launch panel); the transport's values are Live's (None · 8 Bars … 1/32). On the Expressions
 * clock a beat is one beat of the transport's tempo, the field's time scale, and a bar is four beats (the Time signature is the scene's
 * ratio of hold to change, not a metre). A launch lands on the next boundary of its Quantize on that clock: None at once, Global the
 * transport's, and at once when nothing plays. The launch is held in the frame's scene transport, on its one clock, and the reading says
 * it waits. Real authoring model, real composition owner, real retained editor; nothing is stubbed but the native acknowledgement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareNativeSceneEdit} from '../src/sceneEdits.ts';
import {projectNativeScenes} from '../src/scenes.ts';
import {reading as admitted} from '../src/editorHost.ts';
import {READ_LAUNCH_QUANTIZE} from '../src/scenesValidation.ts';
import * as model from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import * as workflow from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/sceneWorkflow.ts';
import {compositionProperties} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelComposition.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';
import {DocumentStore} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/store.ts';
import {createRetainedNativeEditor} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/hostEditor.ts';

const {blankScene, clone, fieldStudies, validateJourney} = model;
const E = 'expression:quantize';
const S = n => `${E}:scene:s${n}`;
const LIVE = ['none', '8 bars', '4 bars', '2 bars', '1 bar', '1/2', '1/2t', '1/4', '1/4t', '1/8', '1/8t', '1/16', '1/16t', '1/32'];
/** Three native Scenes of 10, 8 and 12 s, each with its authored material, the first selected; `properties` the Expression's own. */
function seed(properties = null, clips = {}) {
  const scenes = [10, 8, 12].map((duration, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    if (clips[i + 1]) scene.clip = clips[i + 1];
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Quantize', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: [],
    ...(properties ? {presentation: {schema: 'oi.journey-properties/v1', description: '', loop: false, ...properties}} : {})});
}

test('XS08: the values are Live\'s; a scene keeps Global or one of them, and its old words are read as Live\'s', () => {
  assert.deepEqual([...model.LAUNCH_QUANTIZE], LIVE, 'the transport\'s values, in Live\'s order');
  assert.deepEqual([...model.SCENE_LAUNCH_QUANTIZE], ['global', ...LIVE], 'a scene: Global, or one of the transport\'s values');
  assert.equal(model.EXPRESSION_LAUNCH_QUANTIZE, '1 bar', 'an Expression that names none keeps Live\'s: one bar');
  const j = fieldStudies(); j.scenes[0].clip = {quantize: '1/16t'};
  assert.equal(validateJourney(clone(j)).scenes[0].clip.quantize, '1/16t');
  j.scenes[0].clip = {quantize: 'bar'};
  assert.throws(() => validateJourney(clone(j)), /A scene's launch lands at one of global, none, 8 bars, 4 bars, 2 bars, 1 bar, 1\/2, 1\/2t, 1\/4, 1\/4t, 1\/8, 1\/8t, 1\/16, 1\/16t, 1\/32\./);
  // A scene saved before this round said Now, Next beat or Scene end: Now lands at once (None), Next beat on the beat (1/4); Scene end has
  // no Live word, and the scene follows the transport again (Global, the field removed).
  for (const [old, read] of [['now', 'none'], ['beat', '1/4'], ['scene', undefined]]) {
    const saved = fieldStudies(); saved.scenes[0].clip = {colour: 'var(--fizz)', quantize: old};
    assert.deepEqual(validateJourney(clone(saved)).scenes[0].clip, read === undefined ? {colour: 'var(--fizz)'} : {colour: 'var(--fizz)', quantize: read}, old);
  }
  assert.equal(model.sceneClipRefusal({quantize: 'beat'}) !== null, true, 'an edit writes only Live\'s words');
});

test('XS08: the Expression keeps the transport\'s Quantize in its own properties, read back through the owner\'s document', () => {
  const j = fieldStudies(); j.launchQuantize = '1/8';
  assert.equal(validateJourney(clone(j)).launchQuantize, '1/8');
  assert.equal(compositionProperties(j).launchQuantize, '1/8', 'carried by composition_set, as the loop flag is');
  assert.equal('launchQuantize' in compositionProperties(fieldStudies()), false, 'none named: none carried');
  j.launchQuantize = 'global';
  assert.throws(() => validateJourney(clone(j)), /The transport's Quantize is one of none, 8 bars, 4 bars, 2 bars, 1 bar, 1\/2, 1\/2t, 1\/4, 1\/4t, 1\/8, 1\/8t, 1\/16, 1\/16t, 1\/32\./);
  assert.equal(seed({launchQuantize: '2 bars'}).journey.launchQuantize, '2 bars', 'the native document\'s properties are read');
  assert.equal(seed().journey.launchQuantize, undefined);
});

test('XS08: one owner op sets the transport\'s Quantize; the scenes reading carries it, Live\'s bar where none is kept', () => {
  const view = seed();
  const p = prepareNativeSceneEdit(view, clone(view.journey), {operation: 'launch-quantize', quantize: '1/4'});
  assert.equal(p.label, 'Set the transport\'s Quantize');
  assert.equal(p.snapshot.journey.launchQuantize, '1/4');
  const set = p.request.changes.filter(change => change.change === 'composition_set');
  assert.equal(set.length, 1); assert.equal(set[0].presentation.launchQuantize, '1/4');
  assert.equal(p.request.changes.some(change => change.change === 'scene_material_set'), false, 'no scene is touched');
  for (const quantize of ['global', 'beat', '1/64', 4, null])
    assert.throws(() => prepareNativeSceneEdit(view, clone(view.journey), {operation: 'launch-quantize', quantize}), /The transport's Quantize is one of none, 8 bars/);
  assert.equal(projectNativeScenes(view.journey, view).launch_quantize, '1 bar', 'none kept: Live\'s bar');
  const kept = seed({launchQuantize: '1/2t'});
  assert.equal(projectNativeScenes(kept.journey, kept).launch_quantize, '1/2t');
});

test('XS08: a beat is one beat of the field\'s tempo (its time scale); a launch lands on the next boundary of its Quantize on the scene\'s clock', () => {
  assert.equal(workflow.fieldBeatSeconds(1), 1, 'time scale 1: sixty beats a minute, one a second');
  assert.equal(workflow.fieldBeatSeconds(2), .5);
  assert.equal(workflow.fieldBeatSeconds(0), null, 'time scale 0 holds the field: no beat');
  assert.deepEqual(LIVE.map(word => workflow.launchQuantumBeats(word)), [null, 32, 16, 8, 4, 2, 4 / 3, 1, 2 / 3, .5, 1 / 3, .25, 1 / 6, .125], 'a bar is four beats');
  const lands = over => workflow.launchLandsAt({quantize: '1 bar', playing: true, rate: 1, elapsed: 1.2, timeScale: 1, ...over});
  assert.equal(lands(), 4, 'the next bar');
  assert.equal(lands({quantize: '1/4'}), 2, 'the next beat');
  assert.equal(lands({timeScale: 2}), 2, 'twice the tempo: the bar is two seconds');
  assert.ok(Math.abs(lands({quantize: '1/4t'}) - 4 / 3) < 1e-12, 'a triplet two thirds of the beat');
  assert.equal(lands({quantize: '8 bars', elapsed: 33}), 64);
  assert.equal(lands({quantize: 'none'}), null, 'None lands at once');
  assert.equal(lands({playing: false}), null, 'nothing playing: at once');
  assert.equal(lands({elapsed: 4}), null, 'on the boundary: at once');
  assert.equal(lands({rate: -1}), null, 'played backwards there is no next boundary: at once');
  assert.equal(lands({timeScale: 0}), null, 'no beat: at once');
  // Global follows the transport's Quantize; the scene's own wins.
  const j = fieldStudies();
  assert.equal(workflow.sceneLaunchQuantize(j.scenes[0], j), '1 bar');
  j.launchQuantize = '1/8'; assert.equal(workflow.sceneLaunchQuantize(j.scenes[0], j), '1/8');
  j.scenes[0].clip = {quantize: 'global'}; assert.equal(workflow.sceneLaunchQuantize(j.scenes[0], j), '1/8');
  j.scenes[0].clip = {quantize: 'none'}; assert.equal(workflow.sceneLaunchQuantize(j.scenes[0], j), 'none');
});

test('XS08: a held launch waits on the clock, lands at its boundary or where the playing scene ends, and a stop drops it', () => {
  const frame = over => ({elapsed_seconds: 3.9, scene_playing: true, saved_sequence_playing: false, completed: false, advance_to_scene_index: null, unavailable_reason: null, ...over});
  assert.equal(workflow.heldLaunchVerdict(4, frame()), 'wait');
  assert.equal(workflow.heldLaunchVerdict(4, frame({elapsed_seconds: 4})), 'land');
  assert.equal(workflow.heldLaunchVerdict(4, frame({elapsed_seconds: 4.01})), 'land');
  assert.equal(workflow.heldLaunchVerdict(4, frame({scene_playing: false, completed: true})), 'land', 'the scene ended first');
  assert.equal(workflow.heldLaunchVerdict(4, frame({advance_to_scene_index: 2})), 'land', 'the sequence moved on first');
  assert.equal(workflow.heldLaunchVerdict(4, frame({scene_playing: false, saved_sequence_playing: true})), 'wait', 'the saved sequence still plays');
  assert.equal(workflow.heldLaunchVerdict(4, frame({scene_playing: false})), 'drop', 'a pause or a stop drops it');
  assert.equal(workflow.heldLaunchVerdict(4, frame({unavailable_reason: 'Native Scene pacing is not disclosed'})), 'drop');
});

/** The retained editor on the seed, its native focus acknowledged at once; `controls` the frame's scene transport. */
function retained(controls) {
  const view = seed(), store = new DocumentStore(view.journey), effects = [];
  let selection = {scene_ref: S(1), entity_ref: null};
  const closed = () => { throw Error('closed in this test'); };
  const owner = createRetainedNativeEditor({store, sceneId: () => S(1), selection: () => ({entity_ids: [], step_id: null}),
    nativeView: () => ({...view, document: {...view.document, selection}}),
    nativeSelect: async id => { effects.push(['select', id]); selection = {scene_ref: view.bindings[id].scene_ref, entity_ref: null}; return 'applied'; },
    commit: async () => true, change: fn => store.change(fn), afterHistory: closed, selectLocal: closed, openEditor: closed,
    standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    sceneControls: {read: () => ({scene_ref: S(1), scene_elapsed_seconds: 1.2, expression_time_seconds: 1.2, scene_playing: true, saved_sequence_playing: false,
      field_paused: false, track_preview: false, intent_epoch: 0}), recording: () => false,
    focus: id => effects.push(['focus', id]), transport: action => effects.push(['transport', action]), seek: seconds => effects.push(['seek', seconds]),
    snapshot: closed, ...controls(effects)}});
  return {owner, effects, view};
}

test('XS08: Play on a scene is one launch the frame\'s scene transport lands, never a focus, seek and play the shell times', async () => {
  const held = retained(effects => ({launch: id => effects.push(['launch', id])}));
  await held.owner.scene({operation: 'scene', basis: held.owner.read().basis, intent_epoch: 0, action: 'play-scene', scene_ref: S(2)});
  assert.deepEqual(held.effects, [['select', S(2)], ['launch', S(2)]], 'the native focus first, then one launch; the frame holds or lands it');
  // A frame without the launch receiver plays at once, as before.
  const at = retained(() => ({}));
  await at.owner.scene({operation: 'scene', basis: at.owner.read().basis, intent_epoch: 0, action: 'play-scene', scene_ref: S(2)});
  assert.deepEqual(at.effects, [['select', S(2)], ['focus', S(2)], ['seek', 0], ['transport', 'play']]);
});

test('XS08: the reading says a launch waits (its scene and the second it lands) and which Quantize the transport keeps; anything else is refused', () => {
  const {owner} = retained(() => ({read: () => ({scene_ref: S(1), scene_elapsed_seconds: 1.2, expression_time_seconds: 1.2, scene_playing: true,
    saved_sequence_playing: false, field_paused: false, track_preview: false, intent_epoch: 0, launch_pending: {scene_ref: S(2), at_seconds: 4}})}));
  const read = owner.read();
  assert.deepEqual(read.playback.launch_pending, {scene_ref: S(2), at_seconds: 4});
  assert.equal(read.scenes.launch_quantize, '1 bar');
  assert.equal(admitted(clone(read)), true);
  const none = clone(read); none.playback.launch_pending = null; assert.equal(admitted(none), true, 'nothing waits');
  const older = clone(read); delete older.playback.launch_pending; delete older.scenes.launch_quantize; assert.equal(admitted(older), true, 'an older frame says neither');
  for (const bad of [{scene_ref: '', at_seconds: 4}, {scene_ref: S(2), at_seconds: -1}, {scene_ref: S(2), at_seconds: Infinity}, {scene_ref: S(2)}, 'S2']) {
    const r = clone(read); r.playback.launch_pending = bad; assert.equal(admitted(r), false, JSON.stringify(bad));
  }
  assert.deepEqual([...READ_LAUNCH_QUANTIZE], [...model.LAUNCH_QUANTIZE], 'the reader admits the model\'s words, no more');
  for (const bad of ['global', 'beat', 4]) { const r = clone(read); r.scenes.launch_quantize = bad; assert.equal(admitted(r), false, String(bad)); }
});
