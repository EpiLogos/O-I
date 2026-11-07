// O-I #747 round 890, the walk's finding on XS07: Jump was set from Clip view and kept by the owner, and when Dawn ended nothing jumped —
// the follow action Jump ("Jump to a scene is Live's follow action Jump"; manual §20.1 The Launch panel; "A follow action decides what
// comes after a clip … so that things run on without you pressing each one") was a setting no play read. The scene's "Scene leaves →
// Jump to a scene" trigger is that follow action: where the scene ends of itself, its scene is landed on, as a jump held to the scene's
// end lands (app.ts T5 pendingAtEnd). Stop comes before it; a scene with no jump ends as it did.
// SCRIPTED: the frame's own sources bundled with the app's esbuild; the kernel document goes through the Expressions model's own bridge.
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
const out = mkdtempSync(join(tmpdir(), 'follow-jump-890-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
  return import(pathToFileURL(outfile).href);
};
const transport = await bundle('src/sceneTransport.ts', 'sceneTransport');
const {kernelDocumentToJourney} = await bundle('src/kernelDocumentBridge.ts', 'bridge');
const {blankScene} = await bundle('src/model.ts', 'model');
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');

const E = 'expression:follow-890';
const S = n => `${E}:scene:s${n}`;
function view({jump = null, follow = null} = {}) {
  const scenes = ['Dawn', 'Noon', 'Dusk'].map((name, i) => {
    const scene = blankScene(name); scene.id = S(i + 1); scene.duration = 6; scene.transition = 1;
    if (i === 0 && follow) scene.clip = {follow};
    return {scene_ref: scene.id, revision: 1, title: name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null},
      ...(i === 0 && jump ? {triggers: [{trigger_ref: `${E}:trigger:jump`, occasion: 'scene_leave', target: {kind: 'navigate', scene_ref: jump, entity_ref: null}}]} : {})};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Follow', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}

test('XS07 (walk 890): where a scene with a Jump ends of itself, the scene it jumps to is the one landed on', () => {
  assert.equal(typeof transport.followJumpTarget, 'function', 'the frame reads the follow action Jump');
  const kept = view({jump: S(3)});
  assert.equal(transport.followJumpTarget(kept.journey, kept, 0), 2, 'Dawn jumps to Dusk, not on to Noon');
  assert.equal(transport.followJumpTarget(kept.journey, kept, 1), null, 'Noon keeps no jump: it ends as it did');
});

test('XS07 (walk 890): Stop comes before a Jump; a jump to a scene that is gone, or to itself, lands nowhere', () => {
  const stopped = view({jump: S(3), follow: 'stop'});
  assert.equal(transport.followJumpTarget(stopped.journey, stopped, 0), null, 'a scene that stops never leaves');
  const gone = view({jump: S(3)}); gone.journey.scenes.splice(2, 1);
  assert.equal(transport.followJumpTarget(gone.journey, gone, 0), null);
  const self = view({jump: S(1)});
  assert.equal(transport.followJumpTarget(self.journey, self, 0), null);
  assert.equal(transport.followJumpTarget(self.journey, null, 0), null, 'no native view read: nothing is guessed');
});

test('XS07 (walk 890): the frame lands the follow action Jump as it lands a jump held to the scene\'s end, never on a reverse shuttle', () => {
  assert.match(app, /const followJump=pendingAtEnd===null&&!reverse&&!transportFrame\.unavailable_reason&&\(transportFrame\.completed\|\|transportFrame\.advance_to_scene_index!==null\)\?followJumpTarget\(store\.document,nativeWorkspace\?\.nativeView\(\),sceneIndex\):null;/);
  assert.match(app, /if\(followJump!==null\)pendingAtEnd=store\.document\.scenes\[followJump\]\.id;\s*\/\/ T5 at-end/);
});
