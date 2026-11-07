// O-I #747 round 888, XS07 ("I set what follows each scene so the Expression tells a story": §20.1 The Launch panel, Tips; Clip view,
// Launch panel · Follow action, Jump to): Next scene, Jump to a scene I choose, or Stop follows each scene; a follow action stays on the
// scene's own track (§16.5).
//
// What follows a scene is its clip setting `follow` (Scene.clip): absent or `next`, the Expression goes on to its next scene; `stop`, the
// Expression stops where the scene ends. Jump to a scene is the scene's own "Scene leaves → Jump to a scene" trigger, so it is no clip
// setting. The law is the frame's (model.ts sceneClipRefusal) and the kernel's (expression_scene.rs scene_clip) alike; the transport
// honours it as each scene of the Expression's sequence ends (sceneTransport.ts advanceSceneTransport).
// SCRIPTED: the sources are bundled with the app's own esbuild; nothing plays.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'follow-888-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  return import(pathToFileURL(outfile).href);
};
const model = await bundle(join(journeys, 'src/model.ts'), 'model');
const {advanceSceneTransport} = await bundle(join(journeys, 'src/sceneTransport.ts'), 'sceneTransport');

test('XS07: a scene\'s follow action is Next scene or Stop, kept as its clip setting; Jump is its trigger, no clip setting', () => {
  for (const follow of ['next', 'stop']) assert.equal(model.sceneClipRefusal({follow}), null, follow);
  assert.equal(model.sceneClipRefusal({follow: 'stop', locked: true, quantize: '1 bar'}), null, 'beside the other clip settings');
  for (const bad of ['jump', 'Stop', true, null]) assert.equal(model.sceneClipRefusal({follow: bad}), 'What follows a scene is next or stop.', String(bad));
  assert.equal(model.sceneClipRefusal({jumpTo: 's2'}), 'A scene has no clip setting jumpTo.');
  const j = model.fieldStudies();
  j.scenes[1].clip = {follow: 'stop'};
  assert.deepEqual(model.validateJourney(model.clone(j)).scenes[1].clip, {follow: 'stop'}, 'kept with the Expression and read back');
});

/** Three scenes of 10, 4 and 6 s, all saved, as the Expression's sequence plays them; `follows` sets each scene's follow action. */
function sequence(follows = []) {
  const scenes = [10, 4, 6].map((duration, i) => ({id: `s${i}`, duration, ...(follows[i] ? {clip: {follow: follows[i]}} : {})}));
  return {loop: false, scenes, savedScenes: Object.fromEntries(scenes.map(scene => [scene.id, {id: scene.id, duration: scene.duration}]))};
}
const playing = {playing: true, savedSequence: true, hidden: false, libraryOpen: false, propertyRecording: false, editing: false};
/** The frame that crosses the end of scene `index`, 0.1 s before it. */
const atEnd = (journey, index, state = playing) => advanceSceneTransport(journey, index, journey.scenes[index].duration - 0.1, 0.25, state);

test('XS07: Next scene goes on to the next scene where the scene ends, whether set or absent', () => {
  for (const follows of [[], ['next']]) {
    const frame = atEnd(sequence(follows), 0);
    assert.equal(frame.advance_to_scene_index, 1, `${follows[0] ?? 'absent'}: the next scene`);
    assert.equal(frame.saved_sequence_playing, true, 'and the Expression plays on');
  }
});

test('XS07: Stop stops the Expression where the scene ends; the scene before it and after it keep their own follow', () => {
  const journey = sequence([undefined, 'stop']);
  assert.equal(atEnd(journey, 0).advance_to_scene_index, 1, 'the first scene goes on to the second');
  const mid = advanceSceneTransport(journey, 1, 2, 0.25, playing);
  assert.equal(mid.saved_sequence_playing, true, 'the stopping scene plays to its end');
  assert.equal(mid.advance_to_scene_index, null);
  const stopped = atEnd(journey, 1);
  assert.equal(stopped.advance_to_scene_index, null, 'nothing follows it');
  assert.equal(stopped.saved_sequence_playing, false, 'the Expression stops');
  assert.equal(stopped.scene_playing, false);
  assert.equal(stopped.completed, true);
  const looping = {...sequence(['stop']), loop: true};
  assert.equal(atEnd(looping, 0).saved_sequence_playing, false, 'a looping Expression stops at a scene that says Stop too');
  assert.equal(atEnd(sequence(['stop']), 0, {...playing, savedSequence: false, playing: true}).completed, true,
    'a scene played alone stops at its end as it always did');
});
