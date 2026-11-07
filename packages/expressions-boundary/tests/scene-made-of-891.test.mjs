/** O-I #747 round 891, at the boundary: the scenes reading says what each scene is a render of (manual §10.3 Media: "A render is made from
 *  something else: it names what it was made from … When the source of a render has moved since it was made, the render's row in the
 *  browser says so"), so the Session grid can mark every scene whose source has moved, not only the presented one in its Clip panel. A
 *  scene whose body is a knowledge whole names the constellation and the revision its body was read at; any other body, or none, names
 *  nothing (a text or image source's current revision is Central's file owner's, read for the presented scene: clipBinding.ts).
 * Real authoring model and scenes projection; the native document is the kernel's shape (expression_carrier.rs SceneBody). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectNativeScenes} from '../src/scenes.ts';
import {isNativeScenesReading} from '../src/scenesValidation.ts';
import * as model from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts';
import {kernelDocumentToJourney} from '../../../desktop/cradle/expressions-app/field-studies-journeys/src/kernelDocumentBridge.ts';

const {blankScene} = model;
const E = 'expression:made';
const S = n => `${E}:scene:s${n}`;
const reading = (ref, revision) => ({ref, revision, availability: 'available'});
const WHOLE = 'wiki:node:central';
const bodies = {
  whole: {carrier: 'knowledge_whole', subject_ref: WHOLE, native_owner: 'wiki', reading: reading(WHOLE, '3'), provenance: [reading(WHOLE, '3')], actions: [],
    presentation: 'preview', capability: {state: 'degrades_to_thing', reason: 'Central: a constellation of the wiki.'}, span: null, recursion: null},
  text: {carrier: 'text_source', subject_ref: 'central:notes/a.md', native_owner: 'central', reading: reading('central:notes/a.md', 'r7'),
    provenance: [reading('central:notes/a.md', 'r7')], actions: [], presentation: 'inline', capability: {state: 'renderable'}, span: null, recursion: null},
};
function seed(bodyOf) {
  const scenes = [10, 8, 6].map((duration, i) => {
    const scene = blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    const body = bodyOf[i];
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, ...(body ? {body} : {})};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Made', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
const basis = {expression_ref: E, revision: 4, scene_ref: S(1)};

test('r891: the scenes reading names, for each scene made of a constellation, the constellation and the revision its body was read at', () => {
  const view = seed([bodies.whole, bodies.text, null]);
  const read = projectNativeScenes(view.journey, view);
  assert.deepEqual(read.scenes[0].made_of, {subject_ref: WHOLE, revision: '3'}, 'a knowledge whole: its constellation at its reading');
  // Changed on purpose in round 892 (item 5, scene-file-revision-892): a scene made of a file names it too, with its carrier, so every scene
  // made of a file can carry the mark; its revision now is Central's file owner's, read by the frame (createSceneSourcesNow).
  assert.deepEqual(read.scenes[1].made_of, {subject_ref: 'central:notes/a.md', revision: 'r7', carrier: 'text_source'},
    'a text source is Central\'s file, not a constellation: named with its carrier');
  assert.equal('made_of' in read.scenes[2], false, 'the engine composition is made of nothing');
  assert.equal(isNativeScenesReading(read, basis), true);
});

test('r891: the shell admits a scene\'s made_of only as the reading gives it: a constellation and a revision, nothing else', () => {
  const view = seed([bodies.whole, null, null]);
  const read = projectNativeScenes(view.journey, view);
  const with_ = made_of => ({...read, scenes: read.scenes.map((row, i) => (i === 0 ? {...row, made_of} : row))});
  for (const bad of [null, 'wiki:node:central', {subject_ref: WHOLE}, {subject_ref: WHOLE, revision: 3}, {subject_ref: '', revision: '3'},
    {subject_ref: WHOLE, revision: '3', carrier: 'knowledge_whole'}])
    assert.equal(isNativeScenesReading(with_(bad), basis), false, JSON.stringify(bad));
  assert.equal(isNativeScenesReading(with_({subject_ref: WHOLE, revision: '9'}), basis), true);
});
