// O-I #747 round 895 (DLW build ruling 2026-11-08, and its delta review 2026-11-09, 0b): a press runs exactly what was offered, and the
// consent words are the shell's own (0b.1): the frame's offer is the id of the offer the owner recorded when it withheld the trigger, and
// nothing else the frame says of it is read; a reply that records no offer offers nothing to press. In the frame's own presentation there is
// no Info line, so the withheld words promise no button: they say where it runs. An Action withheld because it asks an authority says so.
// Deleting the presented work closes it in the frame, by behaviour (0b.7): a held open of it is answered with what was deleted and never
// refired, the native workspace forgets it (an open of it waiting for Retry drops; another work's stands), standing on it the frame keeps its
// canvas as no draft and a blank Expression stands, and the field says what was deleted. The frame reports a draft with edits its owner
// does not hold yet (0b.4), and a draft it cannot read counts as unsaved.
// SCRIPTED: the frame's sources bundled with the app's esbuild (the trigger plan and its words, the open intent, the native workspace over
// a host stub with no kernel channel, the deleted work's let-go). CODE-READING: app.ts's wiring of those.
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
const intents = await bundle(join(journeys, 'src/nativeOpenIntent.ts'), 'nativeOpenIntent');
const nativeWorkspace = await bundle(join(journeys, 'src/nativeWorkspace.ts'), 'nativeWorkspace');
const {kernelDocumentToJourney} = await bundle(join(journeys, 'src/kernelDocumentBridge.ts'), 'bridge');
const model = await bundle(join(journeys, 'src/model.ts'), 'model');
const app = readFileSync(join(journeys, 'src/app.ts'), 'utf8');

const E = 'expression:offer-895';
const S = n => `${E}:scene:s${n}`;
function world(kept) {
  const scene = model.blankScene('Dawn'); scene.id = S(1); scene.duration = 6;
  return kernelDocumentToJourney({schema: 'oi.expression/v1', expression_ref: E, revision: 2, title: 'Offers', entities: {}, relations: {},
    scenes: [{scene_ref: scene.id, revision: 1, title: 'Dawn', entity_refs: [], presentation: {schema: 'oi.journey-scene/v1', scene, saved: null}, triggers: kept}],
    selection: {scene_ref: S(1), entity_ref: null}, provenance: [], representations: [], refinements: []});
}
const stamp = {trigger_ref: `${E}:trigger:a`, occasion: 'scene_enter', target: {kind: 'native_action', action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md', authority_requirement: 'none'}};
const RECORDED = {offer_ref: 'offer:3', expression_ref: E, scene_ref: S(1), trigger_ref: `${E}:trigger:a`, action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md',
  trigger_revision: 'sha256:7f', action_title: 'Stamp a page', target_name: 'p.md', reads_only: false, authority_requirement: []};
const withheld = (extra = {}) => ({state: 'withheld', action_ref: 'central.pages.stamp', target_ref: 'central:file:p.md', trigger_ref: stamp.trigger_ref, scene_ref: S(1),
  reads_only: false, authority_requirement: [], detail: 'This Action may write…', offer: RECORDED, ...extra});

test('0b.1: the planned act carries the trigger\'s target, and the offer is the id of the owner\'s record alone', () => {
  const view = world([stamp]);
  const [act] = triggers.planTriggers(view.journey, view, S(1), 'scene_enter', triggers.newTriggerChain());
  assert.equal(act.kind, 'action');
  assert.equal(act.target_ref, 'central:file:p.md');
  const {offer} = triggers.actionSaid(act, withheld());
  assert.deepEqual(offer, {offer_ref: 'offer:3'}, 'the shell reads the record from the owner by its id; the frame names nothing else of it');
  assert.equal(triggers.actionSaid(act, withheld({offer: undefined})).offer, null, 'an answer that records no offer offers nothing to press');
  assert.equal(triggers.actionSaid(act, withheld({offer: {...RECORDED, offer_ref: ''}})).offer, null);
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

test('0b.7: an open of a deleted work drops and resolves unopened, never refired; an open of another work stands', async () => {
  let opened = 0, idle = () => {};
  const changed = [];
  const intent = new intents.NativeOpenIntent({idle: () => new Promise(resolve => {idle = resolve;}), open: async () => {opened++; throw Error('no owner');}, changed: () => changed.push(intent.reference)});
  const waiting = intent.submit('expression:gone', () => true);
  assert.equal(intent.reference, 'expression:gone');
  assert.equal(intent.forget('expression:other'), false, 'another work\'s open is not dropped');
  assert.equal(intent.reference, 'expression:gone');
  assert.equal(intent.forget('expression:gone'), true);
  assert.equal(await waiting, false, 'it resolves unopened');
  assert.equal(intent.reference, undefined);
  idle();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened, 0, 'a dropped open is never refired');

  const failed = intent.submit('expression:gone', () => true);
  idle();
  assert.equal(await failed, false);
  assert.equal(opened, 1);
  assert.equal(intent.reference, 'expression:gone', 'a failed open waits for Retry');
  assert.equal(intent.forget('expression:gone'), true, 'and is dropped when its work is deleted');
  assert.equal(await intent.retry(), false);
  assert.equal(opened, 1, 'Retry finds nothing to refire');
});

test('0b.7: the native workspace forgets a deleted work: its open waiting for Retry drops, and the status offers Retry no more', async () => {
  const statuses = [], journey = model.blankJourney();
  const ws = nativeWorkspace.installNativeWorkspace({snapshot: () => ({journey, sceneId: journey.scenes[0]?.id ?? 'scene-a', entityId: null}), version: () => 1, load: () => {},
    toast: () => {}, summon: () => {}, correspondence: () => {}, shouldRetainDraft: () => false, anchor: () => ({entry: null, length: 0, base: null}),
    status: status => statuses.push(status.retryOpen)});
  assert.equal(await ws.open('expression:gone'), false, 'no kernel channel here: the open fails and waits for Retry');
  assert.equal(statuses.at(-1), true, 'the status offers Retry');
  ws.forget('expression:other');
  assert.equal(statuses.at(-1), true, 'another work deleted: its Retry stands');
  ws.forget('expression:gone');
  assert.equal(statuses.at(-1), false, 'the deleted work\'s Retry goes');
  assert.equal(await ws.retryOpen(), false);
});

test('0b.7: the frame lets go of a deleted work: a held open is answered, never refired, the workspace forgets it, the canvas is no draft and a blank stands', () => {
  const run = (standingOn, heldRef, words) => {
    const calls = [];
    let held = heldRef ? {ref: heldRef, settle: said => calls.push(['settle', said])} : null;
    nativeWorkspace.letGoOfDeletedWork({held: () => held, dropHeld: () => {held = null; calls.push(['dropHeld']);},
      workspace: {nativeView: () => standingOn ? {document: {expression_ref: standingOn}} : null, forget: ref => calls.push(['forget', ref])},
      noDraft: () => calls.push(['noDraft']), blank: () => calls.push(['blank']), say: said => calls.push(['say', said]), announce: () => calls.push(['announce'])}, E, words);
    return {calls, held};
  };
  const words = 'Offers left the works home for Central\'s trash: Central\'s file history brings it back.';
  const standing = run(E, E, words);
  assert.deepEqual(standing.calls, [['dropHeld'], ['settle', words], ['forget', E], ['noDraft'], ['blank'], ['say', words], ['announce']]);
  assert.equal(standing.held, null)
  const elsewhere = run('expression:dusk', 'expression:dusk', words);
  assert.deepEqual(elsewhere.calls, [['forget', E], ['say', words], ['announce']], 'standing on another work, its canvas and its held open stand');
  assert.deepEqual(run(null, null, '').calls, [['forget', E], ['say', nativeWorkspace.DELETED_WORDS], ['announce']], 'with no words the field says it was deleted');
});

test('0b.4: the frame reports a draft with edits its owner does not hold yet; one it cannot read counts as unsaved', () => {
  const clean = {transactionOpen: false, busy: false, dirty: () => false};
  assert.equal(nativeWorkspace.draftUnsaved(clean), false);
  assert.equal(nativeWorkspace.draftUnsaved({...clean, dirty: () => true}), true, 'a draft that differs from the native document');
  assert.equal(nativeWorkspace.draftUnsaved({...clean, transactionOpen: true}), true, 'a gesture open');
  assert.equal(nativeWorkspace.draftUnsaved({...clean, busy: true}), true, 'a commit in flight');
  assert.equal(nativeWorkspace.draftUnsaved({...clean, dirty: () => {throw Error('the draft no longer reads against its work');}}), true, 'a draft it cannot read');
});

test('CODE-READING: the frame words a withheld trigger by its presentation, wires the deleted work\'s let-go, and reports unsaved edits with its state', () => {
  assert.match(app, /const said=actionSaid\(act,reply,framePresentation\(\)\);/);
  assert.match(app, /else if\(d\.command==='close-expression'&&typeof d\.ref==='string'&&d\.ref\.startsWith\('expression:'\)\)closeDeletedExpression\(/);
  assert.match(app, /letGoOfDeletedWork\(\{held:\(\)=>pendingHostOpen,dropHeld:\(\)=>\{pendingHostOpen=null;\},workspace:nativeWorkspace\?\?null,\n  noDraft:\(\)=>\{deletedLibraryIds\.add\(store\.document\.id\);\},blank:\(\)=>applyJourney\(blankJourney\(\)\),say:said=>toast\(said,8000\),announce:announceHostState\},ref,words\);/)
  // Beside the behavioural chain (delete-hold-896.test.mjs): the report is the work's own, not the bound scene's (round 896, 0R-surface.2),
  // every change path announces, and the Delete's hold answers the host's ask.
  assert.match(app, /return unsavedWorks\(\{view:nativeWorkspace\?\.nativeView\(\),transactionOpen:store\.transactionOpen,busy:!!nativeState\?\.busy,dirty:view=>\{/)
  assert.match(app, /unsavedWorks:unsavedNow\(\),/)
  assert.doesNotMatch(app, /unsavedEdits/)
  assert.match(app, /function changed\(fn:\(\)=>void,render:boolean,label:string\)\{if\(heldForDelete\(\)\)return;[^\n]*if\(render\)renderAll\(\);else announceHostState\(\);\}/)
  assert.match(app, /needsFrame=true;renderTimeline\(\);announceHostState\(\);\n\}/, 'a presentation edit announces')
  assert.match(app, /case 'delete-hold':\{\n   if\(command\.action==='release'\)\{deleting\.release\(command\.expression_ref\);return \{ok:true\};\}\n   const unsaved=deleting\.ask\(command\.expression_ref\);/)
});
