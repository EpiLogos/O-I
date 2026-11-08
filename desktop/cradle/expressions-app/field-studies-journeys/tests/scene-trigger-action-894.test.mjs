// O-I #747 round 894, the trigger target "Run a native Action" (manual §20.1 Triggers, Target "Read this Expression · Open a portal ·
// Run a native Action · Jump to a scene"; DLW build ruling 2026-11-07): a trigger fires without a press (Selected, or Scene enters by a
// follow action), so it runs only an Action the kernel answers is a reading (`reads_only`, kernel expression.rs Request::Trigger). An
// Action that may write is not run by a trigger: the Info line names it and offers it, and one press by the person runs it under their
// grant. Round 893 said every native Action and ran none.
// SCRIPTED: the frame's sources bundled with the app's esbuild — the trigger runner over a recording runtime; the words a reply is said
// in. CODE-READING: app.ts asks the owner's `trigger` for the act and hands a withheld one to the shell as an offer.
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
const out = mkdtempSync(join(tmpdir(), 'triggers-894-'));
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
const {DocumentStore} = await bundle(join(journeys, 'src/store.ts'), 'store');
const {createRetainedNativeEditor} = await bundle(join(journeys, 'src/hostEditor.ts'), 'hostEditor');
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');

const E = 'expression:triggers-894';
const S = n => `${E}:scene:s${n}`;
const NAMES = ['Dawn', 'Noon', 'Dusk'];
let serial = 0;
const jump = (occasion, to) => ({trigger_ref: `${E}:trigger:t${++serial}`, occasion, target: {kind: 'navigate', scene_ref: S(to), entity_ref: null}});
const portal = occasion => ({trigger_ref: `${E}:trigger:p${++serial}`, occasion, target: {kind: 'portal', placement: 'beside', subject_ref: 'wiki:node:central'}});
const read = (occasion, operation) => ({trigger_ref: `${E}:trigger:r${++serial}`, occasion, target: {kind: 'expression_operation', operation, expression_ref: E}});
/** Dawn, Noon and Dusk (frame ids s1–s3), each with the triggers given for it. */
function world(kept = {}) {
  const scenes = NAMES.map((name, i) => {
    const scene = model.blankScene(name); scene.id = S(i + 1); scene.duration = 6;
    return {scene_ref: scene.id, revision: 1, title: name, entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, ...(kept[i + 1] ? {triggers: kept[i + 1]} : {})};
  });
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 4, title: 'Triggers', scenes, entities: {}, relations: {},
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
const action = (occasion, action_ref) => ({trigger_ref: `${E}:trigger:a${++serial}`, occasion, target: {kind: 'native_action', action_ref, target_ref: 'central:file:p.md', authority_requirement: 'human'}});
const {sayRequest} = await bundle(join(journeys, 'src/presentedChrome.ts'), 'presentedChrome');

test('a native Action trigger is asked of the owner on every occasion, as its own act, never said away', () => {
  for (const occasion of ['scene_enter', 'scene_leave', 'activate', 'select', 'sequence_transition']) {
    const view = world({2: [action(occasion, 'central.pages.peek')]})
    const acts = triggers.planTriggers(view.journey, view, S(2), occasion, triggers.newTriggerChain())
    assert.deepEqual(acts.map(act => [act.kind, act.said, act.action_ref]), [['action', `Noon ${triggers.OCCASION_SAID[occasion]} → central.pages.peek`, 'central.pages.peek']], occasion)
    assert.equal(acts[0].trigger_ref, view.bindings[S(2)].triggers[0].trigger_ref)
  }
  const view = world({1: [action('scene_enter', 'central.pages.stamp')]})
  const did = []
  triggers.runTriggers({journey: () => view.journey, view: () => view, place: () => did.push('place'), portal: () => did.push('portal'), read: () => did.push('read'),
    say: text => did.push(['say', text]), action: (act, sceneId) => did.push(['action', act.trigger_ref, sceneId])}, S(1), 'scene_enter', triggers.newTriggerChain())
  assert.deepEqual(did, [['action', view.bindings[S(1)].triggers[0].trigger_ref, S(1)]], 'the runner hands the act to the frame, which asks the owner')
})

test('the owner\'s answer is said in one line; an Action that may write is named and offered, never run by the trigger', () => {
  const act = {kind: 'action', trigger_ref: `${E}:trigger:x`, action_ref: 'central.pages.stamp', said: 'Dawn enters → central.pages.stamp'}
  const ran = triggers.actionSaid(act, {state: 'action_result', reads_only: true, dispatch: {state: 'invoked', owner_operation: 'central.pages.peek', data: {}}})
  assert.deepEqual(ran, {text: 'Dawn enters → central.pages.stamp ran.', offer: null})
  const refused = triggers.actionSaid(act, {state: 'action_result', reads_only: true, dispatch: {state: 'owner_refused', owner_operation: 'central.pages.peek', message: 'No such page'}})
  assert.deepEqual(refused, {text: 'Dawn enters → central.pages.stamp was refused: No such page', offer: null})
  const withheld = triggers.actionSaid(act, {state: 'withheld', action_ref: 'central.pages.stamp', trigger_ref: act.trigger_ref, scene_ref: S(1),
    detail: 'This Action may write, and a trigger fires without a press: a trigger runs only a reading. Press it to run it.'})
  assert.equal(withheld.text, 'Dawn enters → central.pages.stamp was not run: it may write, and a trigger runs only a reading. Run runs it once, as your own press.')
  assert.deepEqual(withheld.offer, {trigger_ref: act.trigger_ref, scene_ref: S(1), action_ref: 'central.pages.stamp'})
  assert.deepEqual(triggers.actionSaid(act, null), {text: 'Dawn enters → central.pages.stamp did not act: the owner gave no answer.', offer: null})
})

test('the offer reaches the shell with the words, where the devices present the field; the frame alone says the words', () => {
  const offer = {trigger_ref: `${E}:trigger:x`, scene_ref: S(1), action_ref: 'central.pages.stamp', expression_ref: E}
  assert.deepEqual(sayRequest('devices', 'words', offer), {request: 'say', text: 'words', offer})
  assert.deepEqual(sayRequest('devices', 'words'), {request: 'say', text: 'words'})
  assert.equal(sayRequest('frame', 'words', offer), null)
})

test('CODE-READING: the frame asks the owner\'s trigger for a native Action and hands a withheld one on as an offer', () => {
  assert.match(app, /action:\(act,sceneId\)=>\{[^\n]*nativeExpressionRequest\(\{operation:'trigger',expression_ref:view\.document\.expression_ref,scene_ref:ref,trigger_ref:act\.trigger_ref\}\)/)
  assert.match(app, /const said=actionSaid\(act,reply\);[^\n]*toast\(said\.text,6500,said\.offer\?\{\.\.\.said\.offer,expression_ref:view\.document\.expression_ref\}:undefined\)/)
  assert.match(app, /function toast\(message:string,duration=4200,offer\?:TriggerOffer\)\{[^\n]*sayRequest\(presentedChrome\.presentation\(\),message,offer\)/)
})
