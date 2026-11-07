// O-I #747 round 888, XT07 ("I arm the Expression and record takes of a scene as I play the field": §20.1 Takes and Arrangement lanes,
// §20.2 Transport): the transport's Stop stops the field and rewinds the scene.
//
// The shell's Stop is one working seek to zero (live-shell/ui tests/transport-bindings.test.mjs "Expressions Play and Stop send the owner
// requests the old bar sent"); while a take records it is the take's stop (useExpressionsTransport.tsx pressStop). Here, the frame's side:
//   - the retained editor takes that seek as the scene's focus, then the seek to 0 on the scene's own transport (hostEditor.ts scene);
//   - a seek outside the scene, or on another sequence, is refused in words and nothing moves;
//   - the frame's seek receiver stops both clocks and rewinds (app.ts seekWorkingScene), and a take's stop stops the field and rewinds it
//     to where the take began (app.ts finishPropertyTake).
// SCRIPTED: the editor runs over its real store and the native bridge; the scene's transport is a recorder. The receivers in app.ts are
// read from its source, as app-wiring.test.mjs reads them.
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'transport-888-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  return import(pathToFileURL(outfile).href);
};
const model = await bundle(join(journeys, 'src/model.ts'), 'model');
const bridge = await bundle(join(journeys, 'src/kernelDocumentBridge.ts'), 'bridge');
const {DocumentStore} = await bundle(join(journeys, 'src/store.ts'), 'store');
const {createRetainedNativeEditor} = await bundle(join(journeys, 'src/hostEditor.ts'), 'hostEditor');

const E = 'expression:stop';
const S = n => `${E}:scene:s${n}`;
/** Two native Scenes of 8 and 12 s with their authored material, the first selected, its scene 3.5 s in and playing. */
function editor() {
  const scenes = [8, 12].map((duration, i) => {
    const scene = model.blankScene(`Scene ${i + 1}`); scene.id = S(i + 1); scene.duration = duration; scene.transition = 1;
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  const view = bridge.kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 3, title: 'Stop', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
  const store = new DocumentStore(view.journey);
  const playback = {scene_ref: S(1), scene_elapsed_seconds: 3.5, expression_time_seconds: 3.5, scene_playing: true, saved_sequence_playing: false,
    field_paused: false, track_preview: false, intent_epoch: 0};
  const calls = [], blocked = () => { throw Error('This test does not dispatch that effect') };
  const receiver = createRetainedNativeEditor({store, sceneId: () => S(1), selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: async () => 'applied', commit: blocked, change: (label, mutate) => store.change(label, mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false,
    sceneControls: {read: () => playback, recording: () => false, transitionPending: () => false,
      focus: id => calls.push(['focus', id]), transport: action => calls.push(['transport', action]), seek: seconds => calls.push(['seek', seconds]), snapshot: blocked}});
  return {receiver, calls, basis: receiver.read().basis};
}
const seek = (basis, seconds, extra = {}) => ({operation: 'scene', basis, action: 'seek', scene_ref: S(1), seconds, sequence: 'working', intent_epoch: 0, ...extra});

test('XT07: the transport\'s Stop reaches the scene\'s own transport as its focus, then the seek to its start', async () => {
  const {receiver, calls, basis} = editor();
  await receiver.scene(seek(basis, 0));
  assert.deepEqual(calls, [['focus', S(1)], ['seek', 0]], 'one focus, one rewind to 0; no play, no other transport');
});

test('XT07: a seek outside the scene, or on the saved sequence, is refused in words and the scene stays where it is', async () => {
  const {receiver, calls, basis} = editor();
  for (const bad of [seek(basis, -1), seek(basis, 8.5), seek(basis, Number.NaN), seek(basis, 0, {sequence: 'saved'})])
    await assert.rejects(receiver.scene(bad), /Seek requires a bounded authored working Scene time in seconds/);
  assert.deepEqual(calls, [], 'nothing moved');
});

test('XT07: the frame\'s seek stops the field and rewinds; a take\'s stop stops it and rewinds to where the take began', () => {
  const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');
  assert.match(app, /\bseek:seekWorkingScene,/, 'the retained editor\'s seek is the frame\'s working-scene seek');
  const body = name => { const at = app.indexOf(`function ${name}(`); assert.ok(at >= 0, name); return app.slice(at, app.indexOf('\n', at)) };
  const seekBody = body('seekWorkingScene');
  for (const fact of ['sceneElapsed=seconds', 'scenePlaying=false', 'journeyPlaying=false']) assert.ok(seekBody.includes(fact), `seekWorkingScene: ${fact}`);
  const takeBody = body('finishPropertyTake');
  for (const fact of ['sceneElapsed=take.start', 'scenePlaying=false']) assert.ok(takeBody.includes(fact), `finishPropertyTake: ${fact}`);
});
