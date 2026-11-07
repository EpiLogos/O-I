// O-I #747 round 893, XT02–XT06 (manual §16.6 "Every edit is one labelled step in the undo list"; §10.9 Undo and Redo): the frame's
// side of a cut's way back on the shell's undo list. Each step of the frame's one history gets an id when it is made and keeps it through
// Undo and Redo; the editor's reading names the steps on top of the undo and redo lists by label and id, so the shell runs a cut's Undo
// only while the cut's own step is on top (live-shell/ui tests/scene-cut-undo-893.test.mjs), never a later frame-local edit in its name.
// SCRIPTED: the real store, the retained editor over the native bridge, and the boundary's reading check.
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
const out = mkdtempSync(join(tmpdir(), 'history-893-'));
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
const {reading: isReading} = await bundle(join(journeys, '../../../../packages/expressions-boundary/src/editorHost.ts'), 'editorHost');

const E = 'expression:steps';
const S = n => `${E}:scene:s${n}`;
function editor() {
  const scene = model.blankScene('Dawn'); scene.id = S(1); scene.duration = 8;
  const view = bridge.kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 3, title: 'Steps',
    scenes: [{scene_ref: S(1), revision: 1, title: 'Dawn', entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}}],
    entities: {}, relations: {}, selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
  const store = new DocumentStore(view.journey), blocked = () => { throw Error('This test does not dispatch that effect') };
  const receiver = createRetainedNativeEditor({store, sceneId: () => S(1), selection: () => ({entity_ids: [], step_id: null}), nativeView: () => view,
    nativeSelect: async () => 'applied', commit: blocked, change: (label, mutate) => store.change(label, mutate), afterHistory: blocked, selectLocal: blocked,
    openEditor: blocked, standing: () => ({busy: false, notice: null}), telemetry: () => undefined, fieldPaused: () => false});
  return {store, receiver};
}

test('each step keeps its id through Undo and Redo, and a new step has a new one', () => {
  const {store} = editor();
  assert.equal(store.historyTop('undo'), null);
  store.change('Trim Dawn', d => { d.scenes[0].duration += 1; });
  const cut = store.historyTop('undo');
  assert.equal(cut.label, 'Trim Dawn');
  assert.equal(typeof cut.step, 'string');
  store.change('Move Glyph', d => { d.scenes[0].duration += 1; });
  const edit = store.historyTop('undo');
  assert.notEqual(edit.step, cut.step, 'a later edit is another step');
  store.undo();
  assert.deepEqual(store.historyTop('redo'), edit);
  assert.deepEqual(store.historyTop('undo'), cut, 'Undo leaves the cut on top, by its own id');
  store.undo();
  assert.deepEqual(store.historyTop('redo'), cut);
  store.redo();
  assert.deepEqual(store.historyTop('undo'), cut, 'Redo puts back the same step');
  assert.deepEqual(store.historyTop('redo'), edit);
  assert.notEqual(new DocumentStore(model.fieldStudies()).historyTop('undo')?.step, cut.step);
  const other = new DocumentStore(model.fieldStudies()); other.change('Trim Dawn', d => { d.scenes[0].duration += 1; });
  assert.notEqual(other.historyTop('undo').step, cut.step, 'another editor\'s first step is not this one\'s');
});

test('the editor\'s reading names the steps on top of the frame\'s undo and redo lists, and the boundary admits it', () => {
  const {store, receiver} = editor();
  assert.deepEqual(receiver.read().history, {canUndo: false, canRedo: false});
  assert.equal(isReading(receiver.read()), true);
  store.change('Trim Dawn', d => { d.scenes[0].duration += 1; });
  const cut = store.historyTop('undo');
  store.change('Move Glyph', d => { d.scenes[0].duration += 1; });
  store.undo();
  const read = receiver.read();
  assert.deepEqual(read.history, {canUndo: true, canRedo: true, undo: cut, redo: {label: 'Move Glyph', step: store.historyTop('redo').step}});
  assert.equal(isReading(read), true);
  assert.equal(isReading({...read, history: {...read.history, undo: {label: 'Trim Dawn'}}}), false, 'a top without its id is refused');
  assert.equal(isReading({...read, history: {...read.history, redo: 'Move Glyph'}}), false);
});
