// O-I #747 round 895 (DLW build ruling 2026-11-08): a press runs exactly what was offered, so the frame's offer carries the Action and the
// target the owner withheld (kernel expression.rs Request::Trigger answers both); a reply that names no target offers nothing to press. In
// the frame's own presentation there is no Info line, so the withheld words promise no button: they say where it runs. An Action withheld
// because it asks an authority says so. Deleting the presented work closes it in the frame: the frame lets go of the work, keeps its canvas
// as no draft, a blank Expression stands, a held open of it is dropped, and the field says what was deleted.
// SCRIPTED: the frame's sources bundled with the app's esbuild (the trigger plan and its words). CODE-READING: app.ts and nativeWorkspace.ts.
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
const out = mkdtempSync(join(tmpdir(), 'triggers-895-'));
after(() => rmSync(out, {recursive: true, force: true}));
const bundle = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
    loader: {'.woff': 'dataurl', '.woff2': 'dataurl', '.ttf': 'dataurl', '.svg': 'dataurl', '.png': 'dataurl'}});
  return import(pathToFileURL(outfile).href);
};
const triggers = await bundle(join(journeys, 'src/sceneTriggers.ts'), 'sceneTriggers');
const {kernelDocumentToJourney} = await bundle(join(journeys, 'src/kernelDocumentBridge.ts'), 'bridge');
const model = await bundle(join(journeys, 'src/model.ts'), 'model');
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');
const workspace = readFileSync(join(journeys, 'src/nativeWorkspace.ts'), 'utf8');

const E = 'expression:offer-895';
const S = n => `${E}:scene:s${n}`;
function world(kept) {
  const scene = model.blankScene('Dawn'); scene.id = S(1); scene.duration = 6;
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 2, title: 'Offers', entities: {}, relations: {},
    scenes: [{scene_ref: scene.id, revision: 1, title: 'Dawn', entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, triggers: kept}],
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
const stamp = {trigger_ref: `${E}:trigger:a`, occasion: 'scene_enter', target: {kind: 'native_action', action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md', authority_requirement: 'none'}};
const withheld = (extra = {}) => ({state: 'withheld', action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md', trigger_ref: stamp.trigger_ref, scene_ref: S(1),
  reads_only: false, authority_requirement: [], detail: 'This Action may write…', ...extra});

test('the planned act carries the trigger\'s target, and the offer is the Action and target the owner withheld', () => {
  const view = world([stamp]);
  const [act] = triggers.planTriggers(view.journey, view, S(1), 'scene_enter', triggers.newTriggerChain());
  assert.equal(act.kind, 'action');
  assert.equal(act.target_ref, 'central:file:p.md');
  const {offer} = triggers.actionSaid(act, withheld());
  assert.deepEqual(offer, {trigger_ref: stamp.trigger_ref, scene_ref: S(1), action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md'});
  const {offer: none} = triggers.actionSaid(act, withheld({target_ref: undefined}));
  assert.equal(none, null, 'an answer that names no target offers nothing to press');
});

test('presented on the devices the words name the Run beside them; in the frame\'s own presentation they say where it runs, promising no button', () => {
  const act = {kind: 'action', trigger_ref: stamp.trigger_ref, action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md', said: 'Dawn enters → central.pages.stamp'};
  const devices = triggers.actionSaid(act, withheld(), 'devices');
  assert.equal(devices.text, 'Dawn enters → central.pages.stamp was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.');
  const frame = triggers.actionSaid(act, withheld(), 'frame');
  assert.doesNotMatch(frame.text, /Run runs it/);
  assert.match(frame.text, /present this field on O:I's devices: the status bar's Info line offers its Run\.$/);
  const asks = triggers.actionSaid(act, withheld({reads_only: true, authority_requirement: ['person']}), 'devices');
  assert.equal(asks.text, 'Dawn enters → central.pages.stamp was not run: it asks for an authority (person), and a trigger runs only what asks none. Run runs it once, as your own press.');
});

test('CODE-READING: the frame words a withheld trigger by its presentation, and a deleted work closes in the frame', () => {
  assert.match(app, /const said=actionSaid\(act,reply,framePresentation\(\)\);/);
  assert.match(app, /else if\(d\.command==='close-expression'&&typeof d\.ref==='string'&&d\.ref\.startsWith\('expression:'\)\)closeDeletedExpression\(/);
  const close = app.slice(app.indexOf('function closeDeletedExpression('), app.indexOf('/** The host\'s re-read of an Expression it focused'));
  assert.match(close, /if\(pendingHostOpen\?\.ref===ref\)\{const held=pendingHostOpen;pendingHostOpen=null;held\.settle\(/, 'a held open of the deleted work is dropped, not refired');
  assert.match(close, /nativeWorkspace\?\.forget\(ref\);/);
  assert.match(close, /if\(standing\)\{deletedLibraryIds\.add\(store\.document\.id\);applyJourney\(blankJourney\(\)\);\}/, 'its canvas is kept as no draft; a blank Expression stands');
  assert.match(close, /toast\(words\|\|'This Expression was deleted\.',8000\);/, 'the field says what was deleted');
  assert.match(workspace, /forget:\(reference:string\)=>\{if\(opens\.reference===reference\)\{opens\.cancel\(\);update\(\);\}\},/, 'only an open of that work is dropped');
});
