// XF11 of the walk of O-I #857 (round 53; DLW build ruling 2026-11-09): the Studio's All scenes holds a Field macro's value for every scene
// of the Expression, as its title says; Off unshares it and copies the held value into every scene, each then its own (the app's
// toggleShared: "un-sharing copies the shared value into every Scene"). Off does not give a scene the value it had before On: the editor's
// Undo does (round 54 item 0, the review of #951, F6). §20.3: "a macro can hold for every scene"; the story
// XF11: "The value holds in every scene of the Expression and overrides the scenes' envelopes". The walk (r52-XF11-b-03, r53-XF11) pressed
// All scenes on Time Scale: the frame's editor took the Studio's `shared-setting` change for a sequence edit and refused it ("The sequence
// target is not a formation in this scene"), so nothing was written. SCRIPTED: the real store, the retained editor and the boundary's own
// shared-setting reducer (nativeDeviceEdits.ts, the app's toggleShared); the change is the one the Studio sends (studioBinding.ts).
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
const out = mkdtempSync(join(tmpdir(), 'all-scenes-xf11-'));
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
const {effectiveScene} = await bundle(join(journeys, 'src/sharedSettings.ts'), 'sharedSettings');
const shared = await bundle(join(journeys, '../../../../packages/expressions-boundary/src/nativeSharedSettings.ts'), 'nativeSharedSettings');

const E = 'expression:all-scenes';
const S = n => `${E}:scene:s${n}`;
const binding = shared.SHAREABLE_FIELD_BINDINGS.find(row => row.bind.startsWith('field.params.'));
const target = shared.sharedFieldTarget(binding), param = binding.bind.slice('field.params.'.length);
/** Two scenes, each with its own value of the parameter; the frame stands on the first. */
function editor() {
  const scenes = [1, 2].map(n => {
    const scene = model.blankScene(`Scene ${n}`); scene.id = S(n); scene.duration = 8;
    scene.field.params[param] = binding.defaultValue + n;
    return {scene_ref: scene.id, revision: 1, title: scene.name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}};
  });
  const view = bridge.kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 3, title: 'All scenes', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
  const store = new DocumentStore(view.journey), saved = [], blocked = () => { throw Error('This test does not dispatch that effect') };
  const receiver = createRetainedNativeEditor({store, sceneId: () => S(1), selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: async () => 'applied', commit: async () => { saved.push(structuredClone(store.document.shared?.values ?? {})); return true },
    change: (label, mutate) => store.change(label, mutate), afterHistory: blocked, selectLocal: blocked, openEditor: blocked,
    standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false});
  return {store, receiver, saved};
}
const valueIn = (store, n) => effectiveScene(store.document, store.document.scenes.find(scene => scene.id === S(n))).field.params[param];

test('All scenes On holds the scene\'s value for every scene of the Expression, written and read back; Off copies the held value into every scene', async () => {
  const {store, receiver, saved} = editor();
  assert.ok(binding, 'a shareable Field parameter');
  assert.deepEqual([valueIn(store, 1), valueIn(store, 2)], [binding.defaultValue + 1, binding.defaultValue + 2], 'each scene has its own value');
  assert.equal(receiver.read().sharedTargets.includes(target), false)
  // On: the Studio's change (studioBinding.ts `shared:<id>`), through the editor's one apply.
  await receiver.apply({operation: 'apply', basis: receiver.read().basis, changes: [shared.sharedSettingChange(target, true)]});
  assert.equal(receiver.read().sharedTargets.includes(target), true, 'the reading names the parameter shared');
  assert.deepEqual([valueIn(store, 1), valueIn(store, 2)], [binding.defaultValue + 1, binding.defaultValue + 1], 'the value holds in every scene');
  assert.equal(saved.length, 1, 'the change was written to the owner once');
  assert.equal(saved[0][binding.bind], binding.defaultValue + 1, 'what was written is the Expression\'s value');
  // Off unshares it: every scene keeps the held value as its own (scene 2's own value from before On is not given back; Undo gives it), and
  // the reading says it is no longer shared.
  await receiver.apply({operation: 'apply', basis: receiver.read().basis, changes: [shared.sharedSettingChange(target, false)]});
  assert.equal(receiver.read().sharedTargets.includes(target), false, 'the reading names it local again');
  assert.equal(Object.hasOwn(store.document.shared.values, binding.bind), false, 'the Expression holds it no longer');
  assert.equal(saved.length, 2);
  for (const n of [1, 2]) assert.equal(store.document.scenes[n - 1].field.params[param], binding.defaultValue + 1, `scene ${n} keeps the held value as its own`);
});
